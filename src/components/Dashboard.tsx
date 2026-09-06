import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Battery, Zap, Coins, ArrowLeftRight, TrendingUp, ShieldCheck, Sparkles, Target, ArrowUpRight, Cpu, Fingerprint, Radio, History, CheckCircle2, Siren, Bell, ExternalLink } from 'lucide-react';
import { getSmartMeterData } from '../utils/mockIoT';
import MeterScanner from './MeterScanner';
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

interface IoTProof {
  deviceId: string;
  timestamp: number;
  consumption: number;
  generation: number;
  hash: string;
  onChain: boolean;
}

interface MeterReading {
  consumption: number;
  generation: number;
  timestamp: number;
  source: 'on-chain' | 'simulated' | 'camera';
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
const demoMeterHistory: MeterReading[] = [
  { consumption: 82, generation: 146, timestamp: Date.now() - 480000, source: 'on-chain' },
  { consumption: 76, generation: 131, timestamp: Date.now() - 2280000, source: 'on-chain' },
  { consumption: 91, generation: 118, timestamp: Date.now() - 5520000, source: 'on-chain' }
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
  const [iotProof, setIotProof] = useState<IoTProof | null>(null);
  const [isAnchoring, setIsAnchoring] = useState(false);
  const [meterSource, setMeterSource] = useState<'simulated' | 'camera'>('simulated');
  const [meterHistory, setMeterHistory] = useState<MeterReading[]>(demoMeterHistory);
  const [gridAlertActive, setGridAlertActive] = useState(false);
  const [alertChannel, setAlertChannel] = useState<'browser' | 'telegram'>('browser');
  const [alertSending, setAlertSending] = useState(false);
  const [alertResult, setAlertResult] = useState('');
  const isDemo = account === 'demo-account';
  const energyBalance = meterData.generation - meterData.consumption;
  const hasSurplus = energyBalance >= 0;
  const bestEnergyMatch = availableEnergy.length > 0
    ? [...availableEnergy].sort((first, second) => (first.price / first.amount) - (second.price / second.amount))[0]
    : undefined;
  const smartAmount = hasSurplus ? Math.max(energyBalance, 1) : Math.abs(energyBalance);

  const emergencyMessage = 'ENERGYCHAIN ALERT: Microgrid power spike detected at Node #104. Recommended action: Sell 3 kWh surplus now to earn 0.05 Sepolia ETH.';

  const handleGridAlert = async () => {
    setGridAlertActive(true);
    setAlertSending(true);
    setEnergyAmount('3');
    setEnergyPrice('0.05');
    const deepLink = `${window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') ? 'https://energychain-omega.vercel.app' : window.location.origin}${window.location.pathname}?alert=grid-peak`;
    setAlertResult('Critical event recorded in dashboard. Sending notification...');
    setTransactions(prev => [{ id: `alert-${Date.now()}`, title: 'Critical grid alert', detail: 'Node #104 · 3 kWh trade recommended', amount: 'Alert', time: 'Just now', status: 'Completed' }, ...prev]);
    setToast('Critical grid peak simulated. Trade prepared for 3 kWh.');
    try {
      if (alertChannel === 'browser') {
        if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
        if (!('Notification' in window)) throw new Error('This browser does not support notifications.');
        if (Notification.permission === 'granted') {
          const notification = new Notification('EnergyChain Grid Alert', { body: emergencyMessage, data: deepLink });
          notification.onclick = () => window.open(deepLink, '_blank', 'noopener,noreferrer');
        } else {
          throw new Error('Browser notification permission was not granted.');
        }
        setAlertResult('Browser alert delivered. Trade pre-filled below.');
      } else {
        const response = await fetch('/api/send-alert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: 'telegram', message: emergencyMessage, deepLink }) });
        const responseText = await response.text();
        let result: { delivered?: boolean; error?: string } = {};
        try {
          result = JSON.parse(responseText) as { delivered?: boolean; error?: string };
        } catch {
          throw new Error(`Alert endpoint returned HTTP ${response.status}: ${responseText || 'empty response'}`);
        }
        if (!response.ok) throw new Error(result.error || `Alert endpoint returned HTTP ${response.status}`);
        setAlertResult(result.delivered ? 'Telegram alert delivered.' : 'Alert queued.');
      }
    } catch (error) {
      console.error('Grid alert delivery failed:', error);
      if (alertChannel === 'telegram') {
        if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
        if ('Notification' in window && Notification.permission === 'granted') new Notification('EnergyChain Grid Alert', { body: emergencyMessage });
        setAlertResult(`Telegram failed: ${error instanceof Error ? error.message : 'unknown error'}. Browser fallback was shown.`);
      } else setAlertResult(`Browser notification failed: ${error instanceof Error ? error.message : 'permission blocked'}. The alert is visible on this dashboard.`);
    } finally {
      setAlertSending(false);
      document.getElementById('energy-trading')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSmartMatch = () => {
    if (hasSurplus) {
      setEnergyAmount(smartAmount.toString());
      setEnergyPrice('0.05');
      setToast(`Smart listing prepared for ${smartAmount} kWh surplus`);
      document.getElementById('energy-trading')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (bestEnergyMatch) {
      handleBuyEnergy(bestEnergyMatch);
      return;
    }
    setToast('No matching energy is available yet. Check back after the next listing.');
  };

  const handleCreateIoTProof = async () => {
    setIsAnchoring(true);
    const reading = {
      deviceId: 'SOLAR-METER-07',
      timestamp: Date.now(),
      consumption: meterData.consumption,
      generation: meterData.generation
    };
    try {
      if (isDemo) {
        const hash = ethers.id(JSON.stringify(reading));
        setIotProof({ ...reading, hash, onChain: false });
        setTransactions(prev => [{ id: hash, title: 'IoT reading simulated', detail: `${reading.deviceId} · ${reading.generation} kWh generated`, amount: 'Demo only', time: 'Just now', status: 'Completed', hash }, ...prev]);
        setToast('Demo reading created locally. Connect MetaMask to write it to Sepolia.');
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum!);
      const network = await provider.getNetwork();
      if (network.chainId !== 11155111n) {
        setToast('Please switch MetaMask to Sepolia before recording meter data.');
        return;
      }
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.updateMeterData(reading.consumption, reading.generation);
      setToast('Meter transaction submitted. Confirm it in MetaMask...');
      await tx.wait();
      setIotProof({ ...reading, hash: tx.hash, onChain: true });
      const confirmedReading: MeterReading = { ...reading, source: 'on-chain' };
      setMeterHistory(prev => [confirmedReading, ...prev].slice(0, 8));
      setTransactions(prev => [{ id: tx.hash, title: 'IoT reading recorded on-chain', detail: `${reading.deviceId} · ${reading.generation} kWh generated`, amount: 'Confirmed', time: 'Just now', status: 'Completed', hash: tx.hash }, ...prev]);
      setToast(`Meter data confirmed: ${tx.hash.slice(0, 12)}...`);
    } catch (error) {
      console.error('Error recording meter data:', error);
      setToast('Meter transaction was cancelled or failed.');
    } finally {
      setIsAnchoring(false);
    }
  };

  const handleScannedReading = (generation: number, rawText: string) => {
    setMeterData(prev => ({ ...prev, generation }));
    setMeterSource('camera');
    setToast(`OCR captured ${generation} kWh from the camera. Raw text: ${rawText.slice(0, 40)}`);
  };

  useEffect(() => {
    const updateMeterData = () => {
      const data = getSmartMeterData();
      setMeterData(prev => ({
        ...prev,
        consumption: data.consumption,
        generation: data.generation
      }));
    };

    if (meterSource !== 'simulated') return;
    updateMeterData();
    const interval = setInterval(updateMeterData, 5000);
    return () => clearInterval(interval);
  }, [meterSource]);

  const loadBlockchainData = useCallback(async () => {
    if (isDemo) {
      setMeterData({ consumption: 82, generation: 146, carbonCredits: 64 });
      setAvailableCredits(demoCredits);
      setAvailableEnergy(demoEnergy);
      setMeterHistory(demoMeterHistory);
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
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

      const readings = await contract.getMeterReadings(account);
      setMeterHistory([...readings].slice(-8).reverse().map((reading: { consumption: bigint; generation: bigint; timestamp: bigint }) => ({
        consumption: Number(reading.consumption),
        generation: Number(reading.generation),
        timestamp: Number(reading.timestamp) * 1000,
        source: 'on-chain'
      })));

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
      const nextEnergyListingId = await contract.nextEnergyListingId();
      for (let i = 0n; i < nextEnergyListingId; i++) {
        const listing = await contract['energyListings(uint256)'](i);
        if (listing.isAvailable) {
          energyListings.push({
            id: i.toString(),
            seller: listing.prosumer,
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
  }, [account, isDemo]);

  useEffect(() => {
    loadBlockchainData();
  }, [loadBlockchainData]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('alert') === 'grid-peak') {
      setGridAlertActive(true);
      setEnergyAmount('3');
      setEnergyPrice('0.05');
      setToast('Emergency deep link opened: smart trade prepared.');
    }
  }, []);

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
      const provider = new ethers.BrowserProvider(window.ethereum!);
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
      const provider = new ethers.BrowserProvider(window.ethereum!);
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
      const provider = new ethers.BrowserProvider(window.ethereum!);
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

  const handleBuyEnergy = async (energyListing: EnergyListing) => {
    if (isDemo) {
      setAvailableEnergy(prev => prev.filter(item => item.id !== energyListing.id));
      setMeterData(prev => ({ ...prev, carbonCredits: prev.carbonCredits + energyListing.carbonCredits }));
      setTransactions(prev => [{ id: `tx-${Date.now()}`, title: 'Energy purchased', detail: `${energyListing.amount} kWh from ${energyListing.seller}`, amount: `- ${energyListing.price} ETH`, time: 'Just now', status: 'Completed' }, { id: `tx-credit-${Date.now()}`, title: 'Carbon credits earned', detail: 'Verified renewable energy', amount: `+ ${energyListing.carbonCredits} credits`, time: 'Just now', status: 'Completed' }, ...prev]);
      setToast(`${energyListing.amount} kWh purchased and meter updated`);
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const listing = await contract['energyListings(uint256)'](energyListing.id);
      const tx = await contract['purchaseEnergy(uint256)'](energyListing.id, { value: listing.price });
      await tx.wait();
      setAvailableEnergy(prev => prev.filter(item => item.id !== energyListing.id));
      setTransactions(prev => [{ id: tx.hash, title: 'Energy purchased on-chain', detail: `${listing.energyAmount} kWh from ${energyListing.seller}`, amount: `- ${ethers.formatEther(listing.price)} ETH`, time: 'Just now', status: 'Completed', hash: tx.hash }, ...prev]);
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
              <h2 className="text-xl font-semibold">Current Generation {meterSource === 'camera' && <span className="ml-2 rounded-full bg-cyan-100 px-2 py-1 text-xs text-cyan-700">Camera reading</span>}</h2>
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

        <section className={`mt-8 overflow-hidden rounded-2xl border p-6 shadow-md transition ${gridAlertActive ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4"><div className={`rounded-2xl p-3 ${gridAlertActive ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700'}`}><Siren size={25} /></div><div><div className="mb-1 flex items-center gap-2"><h2 className="text-xl font-black text-slate-950">Emergency Grid Alert</h2>{gridAlertActive && <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-red-700">Critical peak</span>}</div><p className="max-w-2xl text-sm leading-6 text-slate-500">Simulate a microgrid surge and push a recommended trade to a phone. The deep link pre-fills 3 kWh at 0.05 Sepolia ETH.</p></div></div>
            <div className="flex flex-wrap items-center gap-2"><select value={alertChannel} onChange={event => setAlertChannel(event.target.value as 'browser' | 'telegram')} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700"><option value="browser">Browser push · free</option><option value="telegram">Telegram · free</option></select><button onClick={handleGridAlert} disabled={alertSending} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60"><Bell size={17} /> {alertSending ? 'Sending...' : 'Simulate critical peak'}</button></div>
          </div>
          {gridAlertActive && <div className="mt-5 grid gap-3 border-t border-red-200 pt-5 sm:grid-cols-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-red-500">Node</p><p className="mt-1 font-bold text-slate-800">#104 · Microgrid East</p></div><div><p className="text-[10px] font-black uppercase tracking-widest text-red-500">Recommended action</p><p className="mt-1 font-bold text-slate-800">Sell 3 kWh · 0.05 ETH</p></div><div><p className="text-[10px] font-black uppercase tracking-widest text-red-500">Delivery</p><p className="mt-1 flex items-center gap-1 font-bold text-red-700"><ExternalLink size={14} /> {alertResult || 'Preparing trade link...'}</p></div></div>}
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 text-emerald-300"><Sparkles size={18} /><span className="text-xs font-black uppercase tracking-[0.2em]">Smart Grid Match</span></div>
              <h2 className="text-2xl font-black sm:text-3xl">{hasSurplus ? `You have ${smartAmount} kWh to share.` : `You need ${smartAmount} kWh to stay green.`}</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-100/75">Based on your live meter balance, GridSpring recommends the next best market action instead of making you search through every listing.</p>
              <div className="mt-5 flex flex-wrap gap-3 text-xs font-bold"><span className="rounded-full bg-white/10 px-3 py-2">{hasSurplus ? 'Surplus detected' : 'Shortfall detected'}</span><span className="rounded-full bg-white/10 px-3 py-2">{(smartAmount * 0.42).toFixed(1)} kg CO₂ impact</span>{bestEnergyMatch && <span className="rounded-full bg-white/10 px-3 py-2">Best rate: {(bestEnergyMatch.price / bestEnergyMatch.amount).toFixed(5)} ETH/kWh</span>}</div>
            </div>
            <div className="min-w-[230px] rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between"><Target className="text-emerald-300" size={22} /><span className="text-xs font-bold text-emerald-200">MATCH SCORE</span></div>
              <div className="mb-3 flex items-end gap-2"><span className="text-5xl font-black">{bestEnergyMatch ? '94' : hasSurplus ? '88' : '—'}</span><span className="pb-1 text-sm text-emerald-200">/ 100</span></div>
              <button onClick={handleSmartMatch} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-emerald-950 transition hover:bg-emerald-300"><ArrowUpRight size={17} /> {hasSurplus ? 'Prepare smart listing' : 'Take smart match'}</button>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-cyan-100 bg-white p-6 shadow-md">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700"><Cpu size={25} /></div>
              <div><div className="mb-1 flex items-center gap-2"><h2 className="text-xl font-bold text-slate-900">IoT Meter Record</h2><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${isDemo ? 'bg-amber-50 text-amber-700' : 'bg-cyan-50 text-cyan-700'}`}>{isDemo ? 'Simulation' : 'Sepolia'}</span></div><p className="max-w-2xl text-sm leading-6 text-slate-500">Record the current smart-meter reading on the EnergyTrading contract. In live mode, MetaMask signs the transaction and the contract emits a MeterDataUpdated event.</p></div>
            </div>
            <button onClick={handleCreateIoTProof} disabled={isAnchoring} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-5 py-3 text-sm font-black text-white transition hover:bg-cyan-800 disabled:cursor-wait disabled:opacity-60"><Fingerprint size={17} /> {isAnchoring ? 'Waiting for MetaMask...' : isDemo ? 'Simulate meter record' : 'Record on Sepolia'}</button>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-4">
            <div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Device</p><p className="mt-1 font-bold text-slate-800">SOLAR-METER-07</p></div>
            <div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Generation</p><p className="mt-1 font-bold text-emerald-600">{meterData.generation} kWh</p></div>
            <div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</p><p className={`mt-1 flex items-center gap-1 font-bold ${iotProof?.onChain ? 'text-cyan-700' : 'text-amber-600'}`}><Radio size={14} /> {iotProof?.onChain ? 'On-chain' : iotProof ? 'Local demo' : 'Awaiting record'}</p></div>
            <div className="col-span-2 sm:col-span-1"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Reading fingerprint</p><p className="mt-1 truncate font-mono text-xs text-slate-600" title={iotProof?.hash}>{iotProof ? `${iotProof.hash.slice(0, 10)}...${iotProof.hash.slice(-8)}` : 'Not generated'}</p></div>
          </div>
          <div className="mt-5"><MeterScanner onReading={handleScannedReading} /></div>
        </section>

        <section className="mt-8 rounded-2xl bg-slate-950 p-6 text-white shadow-xl">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div><div className="mb-2 flex items-center gap-2 text-emerald-300"><History size={18} /><span className="text-xs font-black uppercase tracking-[0.2em]">Energy Passport</span></div><h2 className="text-2xl font-black">Your generation, with a memory.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">A portable provenance trail for every meter record. Live mode reads directly from the EnergyTrading contract.</p></div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Records tracked</p><p className="mt-1 text-2xl font-black text-emerald-300">{meterHistory.length}</p></div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {meterHistory.slice(0, 3).map((reading, index) => {
              const surplus = reading.generation - reading.consumption;
              return <div key={`${reading.timestamp}-${index}`} className="relative rounded-xl border border-white/10 bg-white/5 p-4"><div className="mb-4 flex items-center justify-between"><span className="text-xs font-bold text-slate-400">{new Date(reading.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span><CheckCircle2 className="text-emerald-400" size={17} /></div><div className="flex items-end gap-4"><div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Generated</p><p className="text-2xl font-black text-emerald-300">{reading.generation}<span className="ml-1 text-xs text-slate-400">kWh</span></p></div><div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Used</p><p className="text-2xl font-black text-slate-200">{reading.consumption}<span className="ml-1 text-xs text-slate-500">kWh</span></p></div></div><p className={`mt-4 text-xs font-bold ${surplus >= 0 ? 'text-emerald-400' : 'text-amber-300'}`}>{surplus >= 0 ? '+' : ''}{surplus} kWh {surplus >= 0 ? 'available to trade' : 'drawn from the grid'}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">{reading.source === 'on-chain' ? 'Contract record' : 'Local reading'}</p></div>;
            })}
          </div>
        </section>

        {/* Carbon Credit Trading Platform */}
        <div id="energy-trading" className="mt-8 bg-white rounded-xl shadow-md p-6">
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
                    placeholder="Enter whole kWh amount"
                    step="1"
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
                        onClick={() => handleBuyEnergy(listing)}
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