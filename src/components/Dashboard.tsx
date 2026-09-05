import React, { useState, useEffect } from 'react';
import { LineChart, Battery, Zap, Coins, ArrowLeftRight, TrendingUp, ShieldCheck } from 'lucide-react';
import { getSmartMeterData } from '../utils/mockIoT';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract';
import { ethers } from 'ethers';

interface DashboardProps {
  account: string;
  onUseWallet?: () => void;
}

interface CarbonCreditListing {
  seller: string;
  amount: number;
  price: number;
  id: string;
}

interface EnergyListing {
  seller: string;
  amount: number;
  price: number;
  carbonCredits: number;
  id: string;
}

interface Transaction {
  id: string;
  title: string;
  detail: string;
  amount: string;
  time: string;
  status: 'Completed' | 'Pending';
  hash?: string;
}

const demoAccount = '0x7A42...91cE';
const demoCredits: CarbonCreditListing[] = [
  { id: 'cc-18', seller: '0x39F1...42aB', amount: 18, price: 0.012 },
  { id: 'cc-22', seller: '0xA120...8D4f', amount: 42, price: 0.009 }
];
const demoEnergy: EnergyListing[] = [
  { id: 'energy-1', seller: '0x39F1...42aB', amount: 240, price: 0.18, carbonCredits: 2 },
  { id: 'energy-2', seller: '0xB81e...103c', amount: 125, price: 0.11, carbonCredits: 1 }
];
const demoTransactions: Transaction[] = [
  { id: 'tx-1', title: 'Energy purchased', detail: '240 kWh from 0x39F1...42aB', amount: '- 0.18 ETH', time: '12 min ago', status: 'Completed' },
  { id: 'tx-2', title: 'Carbon credits earned', detail: 'From verified renewable energy', amount: '+ 2 credits', time: '12 min ago', status: 'Completed' },
  { id: 'tx-3', title: 'Energy listed', detail: '180 kWh at 0.14 ETH', amount: 'Pending', time: 'Yesterday', status: 'Pending' }
];

const Dashboard: React.FC<DashboardProps> = ({ account, onUseWallet }) => {
  const [meterData, setMeterData] = useState({
    consumption: 0,
    generation: 0,
    carbonCredits: 0
  });

  const [creditAmount, setCreditAmount] = useState('');
  const [creditPrice, setCreditPrice] = useState('');
  const [availableCredits, setAvailableCredits] = useState<CarbonCreditListing[]>([]);

  // Energy trading state
  const [energyAmount, setEnergyAmount] = useState('');
  const [energyPrice, setEnergyPrice] = useState('');
  const [availableEnergy, setAvailableEnergy] = useState<EnergyListing[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>(demoTransactions);
  const [toast, setToast] = useState('');
  const isDemo = account === 'demo-account';

  useEffect(() => {
    const updateMeterData = () => {
      const data = getSmartMeterData();
      setMeterData(prev => ({
        ...prev,
        consumption: data.consumption,
        generation: data.generation
      }));
    };

    updateMeterData();
    const interval = setInterval(updateMeterData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadBlockchainData();
  }, [account]);

  const loadBlockchainData = async () => {
    if (isDemo) {
      setMeterData({ consumption: 82, generation: 146, carbonCredits: 64 });
      setAvailableCredits(demoCredits);
      setAvailableEnergy(demoEnergy);
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      if (network.chainId !== 11155111n) {
        setToast('Please switch MetaMask to Sepolia before using live transactions.');
        return;
      }
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      // Load carbon credits balance
      const credits = await contract.carbonCredits(account);
      setMeterData(prev => ({ ...prev, carbonCredits: Number(credits) }));

      // Load available carbon credit listings
      const listings = [];
      const nextListingId = await contract.nextCreditListingId();
      
      for (let i = 0; i < nextListingId; i++) {
        const listing = await contract.getCarbonCreditListing(i);
        if (listing.isAvailable) {
          listings.push({
            id: i.toString(),
            seller: listing.seller,
            amount: Number(listing.amount),
            price: Number(ethers.formatEther(listing.price))
          });
        }
      }
      setAvailableCredits(listings);

      const energyListings: EnergyListing[] = [];
      const energyEvents = await contract.queryFilter(contract.filters.EnergyListed(), 0, 'latest');
      const sellers = new Set<string>();
      sellers.add(account);
      for (const event of energyEvents) {
        const seller = (event as ethers.EventLog).args?.[0] as string | undefined;
        if (seller) sellers.add(seller);
      }
      for (const seller of sellers) {
        const listing = await contract.energyListings(seller);
        if (listing.isAvailable) {
          energyListings.push({
            id: seller,
            seller,
            amount: Number(listing.energyAmount),
            price: Number(ethers.formatEther(listing.price)),
            carbonCredits: Number(listing.carbonCredits)
          });
        }
      }
      setAvailableEnergy(energyListings);

    } catch (error) {
      console.error('Error loading blockchain data:', error);
    }
  };

  const handleListCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemo) {
      const amount = Number(creditAmount);
      const price = Number(creditPrice);
      if (!amount || !price) return;
      setAvailableCredits(prev => [{ id: `demo-${Date.now()}`, seller: demoAccount, amount, price }, ...prev]);
      setMeterData(prev => ({ ...prev, carbonCredits: Math.max(0, prev.carbonCredits - amount) }));
      setTransactions(prev => [{ id: `tx-${Date.now()}`, title: 'Credits listed', detail: `${amount} credits at ${price} ETH each`, amount: 'Pending', time: 'Just now', status: 'Pending' }, ...prev]);
      setToast('Carbon credits listed in demo marketplace');
      setCreditAmount(''); setCreditPrice('');
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const amount = ethers.parseUnits(creditAmount, 0);
      const price = ethers.parseEther(creditPrice);

      const tx = await contract.listCarbonCredits(amount, price);
      await tx.wait();
      setTransactions(prev => [{ id: tx.hash, title: 'Credits listed on-chain', detail: `${creditAmount} credits at ${creditPrice} ETH each`, amount: 'Confirmed', time: 'Just now', status: 'Completed', hash: tx.hash }, ...prev]);
      setToast(`Confirmed in MetaMask: ${tx.hash.slice(0, 10)}...`);

      // Reload data
      await loadBlockchainData();
      
      // Reset form
      setCreditAmount('');
      setCreditPrice('');
    } catch (error) {
      console.error('Error listing credits:', error);
      alert('Error listing credits. Please check the console for details.');
    }
  };

  const handleBuyCredits = async (listing: CarbonCreditListing) => {
    if (isDemo) {
      setAvailableCredits(prev => prev.filter(item => item.id !== listing.id));
      setMeterData(prev => ({ ...prev, carbonCredits: prev.carbonCredits + listing.amount }));
      setTransactions(prev => [{ id: `tx-${Date.now()}`, title: 'Carbon credits purchased', detail: `${listing.amount} credits from ${listing.seller}`, amount: `- ${(listing.price * listing.amount).toFixed(3)} ETH`, time: 'Just now', status: 'Completed' }, ...prev]);
      setToast(`${listing.amount} carbon credits added to your wallet`);
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const totalPrice = ethers.parseEther((listing.price * listing.amount).toString());
      const tx = await contract.purchaseCarbonCredits(listing.id, { value: totalPrice });
      await tx.wait();
      setTransactions(prev => [{ id: tx.hash, title: 'Carbon credits purchased on-chain', detail: `${listing.amount} credits from ${listing.seller}`, amount: `- ${(listing.price * listing.amount).toFixed(3)} ETH`, time: 'Just now', status: 'Completed', hash: tx.hash }, ...prev]);
      setToast(`Confirmed in MetaMask: ${tx.hash.slice(0, 10)}...`);

      // Reload data
      await loadBlockchainData();
    } catch (error) {
      console.error('Error buying credits:', error);
      alert('Error buying credits. Please check the console for details.');
    }
  };

  const handleListEnergy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemo) {
      const amount = Number(energyAmount);
      const price = Number(energyPrice);
      if (!amount || !price) return;
      setAvailableEnergy(prev => [{ id: `demo-${Date.now()}`, seller: demoAccount, amount, price, carbonCredits: Math.floor(amount / 100) }, ...prev]);
      setTransactions(prev => [{ id: `tx-${Date.now()}`, title: 'Energy listed', detail: `${amount} kWh at ${price} ETH`, amount: 'Pending', time: 'Just now', status: 'Pending' }, ...prev]);
      setToast('Energy listing published in demo marketplace');
      setEnergyAmount(''); setEnergyPrice('');
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const amount = ethers.parseUnits(energyAmount, 0);
      const price = ethers.parseEther(energyPrice);

      const tx = await contract.listEnergy(amount, price);
      await tx.wait();
      setAvailableEnergy(prev => [{
        id: account,
        seller: account,
        amount: Number(energyAmount),
        price: Number(energyPrice),
        carbonCredits: Math.floor(Number(energyAmount) / 100)
      }, ...prev.filter(listing => listing.seller !== account)]);
      setTransactions(prev => [{ id: tx.hash, title: 'Energy listed on-chain', detail: `${energyAmount} kWh at ${energyPrice} ETH`, amount: 'Confirmed', time: 'Just now', status: 'Completed', hash: tx.hash }, ...prev]);
      setToast(`Confirmed in MetaMask: ${tx.hash.slice(0, 10)}...`);

      // Reload data
      await loadBlockchainData();
      
      // Reset form
      setEnergyAmount('');
      setEnergyPrice('');
    } catch (error) {
      console.error('Error listing energy:', error);
      alert('Error listing energy. Please check the console for details.');
    }
  };

  const handleBuyEnergy = async (seller: string) => {
    if (isDemo) {
      const listing = availableEnergy.find(item => item.seller === seller);
      if (!listing) return;
      setAvailableEnergy(prev => prev.filter(item => item.id !== listing.id));
      setMeterData(prev => ({ ...prev, carbonCredits: prev.carbonCredits + listing.carbonCredits }));
      setTransactions(prev => [{ id: `tx-${Date.now()}`, title: 'Energy purchased', detail: `${listing.amount} kWh from ${listing.seller}`, amount: `- ${listing.price} ETH`, time: 'Just now', status: 'Completed' }, { id: `tx-credit-${Date.now()}`, title: 'Carbon credits earned', detail: 'Verified renewable energy', amount: `+ ${listing.carbonCredits} credits`, time: 'Just now', status: 'Completed' }, ...prev]);
      setToast(`${listing.amount} kWh purchased and meter updated`);
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const listing = await contract.energyListings(seller);
      const tx = await contract.purchaseEnergy(seller, { value: listing.price });
      await tx.wait();
      setTransactions(prev => [{ id: tx.hash, title: 'Energy purchased on-chain', detail: `${listing.energyAmount} kWh from ${seller}`, amount: `- ${ethers.formatEther(listing.price)} ETH`, time: 'Just now', status: 'Completed', hash: tx.hash }, ...prev]);
      setToast(`Confirmed in MetaMask: ${tx.hash.slice(0, 10)}...`);

      // Reload data
      await loadBlockchainData();
    } catch (error) {
      console.error('Error buying energy:', error);
      alert('Error buying energy. Please check the console for details.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h1 className="text-3xl font-bold text-gray-800">Energy Dashboard</h1>
              {isDemo && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">DEMO MODE</span>}
            </div>
              <div className="flex items-center gap-3"><p className="text-gray-600">Connected Account: {isDemo ? demoAccount : account}</p>{isDemo && <button onClick={onUseWallet} className="text-sm font-semibold text-purple-600 hover:text-purple-800">Use MetaMask</button>}</div>
          </div>
          <button onClick={loadBlockchainData} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:border-green-400">
            Refresh marketplace
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center mb-4">
              <Battery className="w-6 h-6 text-green-500 mr-2" />
              <h2 className="text-xl font-semibold">Current Generation</h2>
            </div>
            <p className="text-3xl font-bold text-green-500">{meterData.generation} kWh</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center mb-4">
              <Zap className="w-6 h-6 text-blue-500 mr-2" />
              <h2 className="text-xl font-semibold">Consumption</h2>
            </div>
            <p className="text-3xl font-bold text-blue-500">{meterData.consumption} kWh</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center mb-4">
              <Coins className="w-6 h-6 text-yellow-500 mr-2" />
              <h2 className="text-xl font-semibold">Carbon Credits</h2>
            </div>
            <p className="text-3xl font-bold text-yellow-500">{meterData.carbonCredits}</p>
          </div>
        </div>

        {/* Carbon Credit Trading Platform */}
        <div className="mt-8 bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center mb-6">
            <ArrowLeftRight className="w-6 h-6 text-purple-500 mr-2" />
            <h2 className="text-2xl font-bold">Carbon Credit Trading</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* List Carbon Credits */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
                <h3 className="text-xl font-semibold">List Carbon Credits</h3>
              </div>
              <form onSubmit={handleListCredits} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount of Credits
                  </label>
                  <input
                    type="number"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter amount"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price per Credit (ETH)
                  </label>
                  <input
                    type="number"
                    value={creditPrice}
                    onChange={(e) => setCreditPrice(e.target.value)}
                    className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter price in ETH"
                    step="0.001"
                    min="0"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors"
                >
                  List Credits
                </button>
              </form>
            </div>

            {/* Available Carbon Credits */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <Coins className="w-5 h-5 text-yellow-600 mr-2" />
                <h3 className="text-xl font-semibold">Available Carbon Credits</h3>
              </div>
              <div className="space-y-4">
                {availableCredits.map((listing) => (
                  <div
                    key={listing.id}
                    className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">Seller: {listing.seller}</span>
                      <span className="text-sm font-medium text-purple-600">
                        {listing.price} ETH/credit
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{listing.amount} Credits Available</span>
                      <button
                        onClick={() => handleBuyCredits(listing)}
                        className="bg-green-600 text-white py-1 px-4 rounded-md hover:bg-green-700 transition-colors text-sm"
                      >
                        Buy Credits
                      </button>
                    </div>
                  </div>
                ))}
                {availableCredits.length === 0 && (
                  <p className="text-gray-500 text-center">No carbon credits available for purchase</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Energy Trading Section */}
        <div className="mt-8 bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center mb-4">
            <LineChart className="w-6 h-6 text-purple-500 mr-2" />
            <h2 className="text-xl font-semibold">Energy Trading</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">List Energy for Sale</h3>
              <form onSubmit={handleListEnergy} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount (kWh)
                  </label>
                  <input
                    type="number"
                    value={energyAmount}
                    onChange={(e) => setEnergyAmount(e.target.value)}
                    className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter amount"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (ETH)
                  </label>
                  <input
                    type="number"
                    value={energyPrice}
                    onChange={(e) => setEnergyPrice(e.target.value)}
                    className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter price in ETH"
                    step="0.001"
                    min="0"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors"
                >
                  List Energy
                </button>
              </form>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Available Energy</h3>
              <div className="space-y-4">
                {availableEnergy.map((listing, index) => (
                  <div
                    key={index}
                    className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">Seller: {listing.seller}</span>
                      <span className="text-sm font-medium text-purple-600">
                        {listing.price} ETH
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{listing.amount} kWh Available</span>
                      <button
                        onClick={() => handleBuyEnergy(listing.seller)}
                        className="bg-green-600 text-white py-1 px-4 rounded-md hover:bg-green-700 transition-colors text-sm"
                      >
                        Buy Energy
                      </button>
                    </div>
                  </div>
                ))}
                {availableEnergy.length === 0 && (
                  <p className="text-gray-500 text-center">No energy listings available</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow-md lg:col-span-2">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Recent activity</h2>
                <p className="mt-1 text-sm text-gray-500">A clear audit trail for every marketplace action.</p>
              </div>
              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">{transactions.length} transactions</span>
            </div>
            <div className="divide-y divide-gray-100">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`rounded-full p-2 ${transaction.title.includes('earned') ? 'bg-yellow-100 text-yellow-700' : transaction.title.includes('purchased') ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {transaction.title.includes('earned') ? <Coins size={16} /> : transaction.title.includes('purchased') ? <ArrowLeftRight size={16} /> : <TrendingUp size={16} />}
                    </div>
                    <div className="min-w-0"><p className="truncate text-sm font-bold text-gray-800">{transaction.title}</p><p className="truncate text-xs text-gray-500">{transaction.detail} · {transaction.time}</p></div>
                  </div>
                  <div className="shrink-0 text-right"><p className="text-sm font-bold text-gray-800">{transaction.amount}</p><p className={`text-xs font-semibold ${transaction.status === 'Completed' ? 'text-green-600' : 'text-amber-600'}`}>{transaction.status}</p></div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-slate-900 p-6 text-white shadow-md">
            <div className="mb-5 flex items-center gap-3"><ShieldCheck className="text-green-400" /><h2 className="text-xl font-bold">Verified impact</h2></div>
            <p className="text-sm leading-6 text-slate-300">Your activity is tied to smart-meter readings and settled through the EnergyTrading contract.</p>
            <div className="mt-6 space-y-4 border-t border-slate-700 pt-5 text-sm"><div className="flex justify-between"><span className="text-slate-400">Renewable share</span><strong>64%</strong></div><div className="flex justify-between"><span className="text-slate-400">CO₂ avoided</span><strong>86.4 kg</strong></div><div className="flex justify-between"><span className="text-slate-400">Network</span><strong className="text-green-400">Sepolia testnet</strong></div></div>
          </div>
        </div>
        {toast && <button onClick={() => setToast('')} className="fixed bottom-6 right-6 flex items-center gap-3 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-xl"><span>{toast}</span><span className="text-slate-400">×</span></button>}
      </div>
    </div>
  );
};

export default Dashboard;