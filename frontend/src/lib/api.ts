import axios from 'axios';
import { Chain, Wallet, Transaction, Invoice, Merchant, DashboardStats, User, Project } from '@/types';

const API_BASE_URL = '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Transform snake_case to camelCase for all API responses
function snakeToCamel(obj: any): any {
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (obj && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
      acc[camelKey] = snakeToCamel(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}

// Add response interceptor to transform snake_case to camelCase
apiClient.interceptors.response.use((response) => {
  response.data = snakeToCamel(response.data);
  return response;
}, (error) => {
  return Promise.reject(error);
});

// Add token to requests if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('eclipay_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authApi = {
  login: async (username: string, password: string): Promise<{ token: string; user: User }> => {
    const response = await apiClient.post('/auth/login', { username, password });
    return response.data;
  },

  register: async (username: string, password: string, email: string): Promise<{ token: string; user: User }> => {
    const response = await apiClient.post('/auth/register', { username, password, email });
    return response.data;
  },
  
  logout: () => {
    localStorage.removeItem('eclipay_token');
    localStorage.removeItem('eclipay_selected_project');
  },
  
  getProfile: async (): Promise<User> => {
    const response = await apiClient.get('/auth/profile');
    return response.data;
  },
};

// Projects API
export const projectsApi = {
  getAll: async (): Promise<Project[]> => {
    const response = await apiClient.get('/projects');
    return response.data;
  },

  create: async (data: { name: string; webhookUrl?: string; environment?: 'testnet' | 'mainnet' }): Promise<{ project: Project; apiKey: string }> => {
    const response = await apiClient.post('/projects', data);
    return response.data;
  },

  getById: async (id: string): Promise<Project> => {
    const response = await apiClient.get(`/projects/${id}`);
    return response.data;
  },

  update: async (id: string, data: { name?: string; webhookUrl?: string }): Promise<Project> => {
    const response = await apiClient.patch(`/projects/${id}`, data);
    return response.data;
  },

  regenerateKey: async (id: string): Promise<{ apiKey: string }> => {
    const response = await apiClient.post(`/projects/${id}/regenerate-key`);
    return response.data;
  },

  getSettings: async (id: string): Promise<{ name: string; webhookUrl?: string; apiKey: string }> => {
    const response = await apiClient.get(`/projects/${id}/settings`);
    return response.data;
  },

  updateSettings: async (id: string, data: { name?: string; webhookUrl?: string }): Promise<void> => {
    await apiClient.patch(`/projects/${id}/settings`, data);
  },
};

// Dashboard API
export const dashboardApi = {
  getStats: async (projectId: string): Promise<DashboardStats> => {
    const response = await apiClient.get(`/projects/${projectId}/stats`);
    return response.data;
  },
  
  getRecentTransactions: async (projectId: string, limit = 10): Promise<Transaction[]> => {
    const response = await apiClient.get(`/projects/${projectId}/transactions?limit=${limit}`);
    return response.data; // Backend returns array directly
  },
};

// Chains API
export const chainsApi = {
  getAll: async (testnet?: boolean): Promise<Chain[]> => {
    const params = testnet !== undefined ? { testnet } : {};
    const response = await apiClient.get('/chains', { params });
    return response.data;
  },
  
  getById: async (id: string): Promise<Chain> => {
    const response = await apiClient.get(`/chains/${id}`);
    return response.data;
  },
};

// Wallets API
export const walletsApi = {
  getAll: async (projectId: string): Promise<Wallet[]> => {
    const response = await apiClient.get(`/projects/${projectId}/wallets`);
    return response.data;
  },
  
  create: async (projectId: string, chainId: string): Promise<Wallet> => {
    const response = await apiClient.post(`/projects/${projectId}/wallets`, { chainId });
    return response.data;
  },
  
  getById: async (projectId: string, id: string): Promise<Wallet> => {
    const response = await apiClient.get(`/projects/${projectId}/wallets/${id}`);
    return response.data;
  },
};

// Transactions API
export const transactionsApi = {
  getAll: async (projectId: string, params?: {
    chainId?: string;
    status?: string;
    type?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }): Promise<Transaction[]> => {
    const response = await apiClient.get(`/projects/${projectId}/transactions`, { params });
    return response.data; // Backend returns array directly
  },
  
  getById: async (projectId: string, id: string): Promise<Transaction> => {
    const response = await apiClient.get(`/projects/${projectId}/transactions/${id}`);
    return response.data;
  },
};

// Invoices API
export const invoicesApi = {
  getAll: async (projectId: string, params?: {
    status?: string;
    chainId?: string;
    page?: number;
    limit?: number;
  }): Promise<Invoice[]> => {
    const response = await apiClient.get(`/projects/${projectId}/invoices`, { params });
    return response.data; // Backend returns array directly
  },
  
  create: async (projectId: string, data: {
    chainId: string;
    amount: string;
    expiresIn?: number;
  }): Promise<Invoice> => {
    const response = await apiClient.post(`/projects/${projectId}/invoices`, data);
    return response.data;
  },
  
  getById: async (projectId: string, id: string): Promise<Invoice> => {
    const response = await apiClient.get(`/projects/${projectId}/invoices/${id}`);
    return response.data;
  },
  
  cancel: async (projectId: string, id: string): Promise<void> => {
    await apiClient.post(`/projects/${projectId}/invoices/${id}/cancel`);
  },
  
  // Public endpoint (no auth required)
  getPublic: async (id: string): Promise<{
    id: number;
    amount: string;
    status: string;
    chain: { id: number; name: string; symbol: string };
    paymentAddress: string;
    expiredAt: string;
    createdAt: string;
  }> => {
    // Create a client without auth headers for public endpoint
    const response = await fetch(`/api/invoices/${id}/public`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return snakeToCamel(data);
  },
};

// Legacy Settings API - now handled through projects
export const settingsApi = {
  updateWebhook: async (webhookUrl: string): Promise<void> => {
    await apiClient.put('/settings/webhook', { webhookUrl });
  },
  
  getSettings: async (): Promise<{ webhookUrl?: string }> => {
    const response = await apiClient.get('/settings');
    return response.data;
  },
};