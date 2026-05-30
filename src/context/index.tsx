import { createContext, useContext, FC, ReactNode, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import contractABI from '../contract/abi.json';

const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

interface Campaign {
  owner: string;
  title: string;
  description: string;
  target: string;
  deadline: number;
  amountCollected: string;
  image: string;
  donors: string[];
  donations: string[];
  pId: number;
}

interface StateInterface {
  address: string;
  contract: ethers.Contract | null;
  connect: () => Promise<void>;
  createCampaign: (form: any) => Promise<void>;
  getCampaigns: () => Promise<Campaign[]>;
  getUserCampaigns: () => Promise<Campaign[]>;
  donate: (pId: number, amount: string) => Promise<void>;
  getDonations: (pId: number) => Promise<{ donator: string; donation: string }[]>;
}

export const StateContext = createContext<StateInterface>({
  address: '',
  contract: null,
  connect: async () => {},
  createCampaign: async () => {},
  getCampaigns: async () => [],
  getUserCampaigns: async () => [],
  donate: async () => {},
  getDonations: async () => [],
});

interface stateProps {
  children: ReactNode;
}

export const StateContextProvider: FC<stateProps> = ({ children }) => {
  const [address, setAddress] = useState<string>('');
  const [contract, setContract] = useState<ethers.Contract | null>(null);

  const getContract = useCallback((signerOrProvider: ethers.Signer | ethers.providers.Provider) => {
    return new ethers.Contract(CONTRACT_ADDRESS, contractABI, signerOrProvider);
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask!');
      return;
    }
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send('eth_requestAccounts', []);
    const signer = provider.getSigner();
    const addr = await signer.getAddress();
    setAddress(addr);
    setContract(getContract(signer));
  }, [getContract]);

  const checkConnection = useCallback(async () => {
    if (!window.ethereum) return;
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const accounts = await provider.listAccounts();
    if (accounts.length > 0) {
      const signer = provider.getSigner();
      const addr = await signer.getAddress();
      setAddress(addr);
      setContract(getContract(signer));
    }
  }, [getContract]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAddress('');
        setContract(null);
      } else {
        checkConnection();
      }
    };
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, [checkConnection]);

  const createCampaign = async (form: {
    title: string;
    description: string;
    target: ethers.BigNumber;
    deadline: string;
    image: string;
  }) => {
    if (!contract) return;
    try {
      const tx = await contract.createCampaign(
        form.title,
        form.description,
        form.target,
        new Date(form.deadline).getTime(),
        form.image
      );
      await tx.wait();
    } catch (error) {
      console.log('contract call failure', error);
    }
  };

  const getCampaigns = async (): Promise<Campaign[]> => {
    if (!contract) return [];
    const campaigns = await contract.getCampaigns();
    return campaigns.map((campaign: any, i: number) => ({
      owner: campaign.owner,
      title: campaign.title,
      description: campaign.description,
      target: ethers.utils.formatEther(campaign.target.toString()),
      deadline: campaign.deadline.toNumber(),
      amountCollected: ethers.utils.formatEther(campaign.collectedAmount.toString()),
      image: campaign.image,
      donors: campaign.donors,
      donations: campaign.donations.map((d: ethers.BigNumber) => d.toString()),
      pId: i,
    }));
  };

  const getUserCampaigns = async (): Promise<Campaign[]> => {
    const allCampaigns = await getCampaigns();
    return allCampaigns.filter((campaign) => campaign.owner === address);
  };

  const donate = async (pId: number, amount: string) => {
    if (!contract) return;
    const tx = await contract.donateToCampaign(pId, {
      value: ethers.utils.parseEther(amount),
    });
    await tx.wait();
  };

  const getDonations = async (pId: number) => {
    if (!contract) return [];
    const [donors, donations] = await contract.getDonors(pId);
    return donors.map((donator: string, i: number) => ({
      donator,
      donation: ethers.utils.formatEther(donations[i].toString()),
    }));
  };

  return (
    <StateContext.Provider
      value={{
        address,
        contract,
        connect,
        createCampaign,
        getCampaigns,
        getUserCampaigns,
        donate,
        getDonations,
      }}
    >
      {children}
    </StateContext.Provider>
  );
};

export const useStateContext = () => useContext(StateContext);
