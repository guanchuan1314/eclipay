'use client';

import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Wallet, 
  ArrowUpDown, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  X,
  Plus,
  ChevronDown
} from 'lucide-react';
import { User, Project } from '@/types';
import { projectsApi } from '@/lib/api';
import DashboardOverview from './DashboardOverview';
import WalletsPage from './WalletsPage';
import TransactionsPage from './TransactionsPage';
import InvoicesPage from './InvoicesPage';
import SettingsPage from './SettingsPage';
import ApiDocsPage from './ApiDocsPage';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

type Page = 'dashboard' | 'wallets' | 'transactions' | 'invoices' | 'settings' | 'docs';

const navigation = [
  { name: 'Dashboard', page: 'dashboard' as Page, icon: LayoutDashboard },
  { name: 'Wallets', page: 'wallets' as Page, icon: Wallet },
  { name: 'Transactions', page: 'transactions' as Page, icon: ArrowUpDown },
  { name: 'Invoices', page: 'invoices' as Page, icon: FileText },
  { name: 'Settings', page: 'settings' as Page, icon: Settings },
  { name: 'API Docs', page: 'docs' as Page, icon: FileText },
];

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [currentPage, _setCurrentPage] = useState<Page>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('eclipay_active_page') as Page) || 'dashboard';
    }
    return 'dashboard';
  });
  const setCurrentPage = (page: Page) => {
    _setCurrentPage(page);
    localStorage.setItem('eclipay_active_page', page);
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [projectEnvironment, setProjectEnvironment] = useState<'testnet' | 'mainnet'>('testnet');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showProjectDropdown) {
        setShowProjectDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showProjectDropdown]);

  const loadProjects = async () => {
    try {
      setIsLoadingProjects(true);
      const projectList = await projectsApi.getAll();
      setProjects(projectList);
      
      // Auto-select project from localStorage or first project
      const savedProjectId = localStorage.getItem('eclipay_selected_project');
      if (savedProjectId) {
        const project = projectList.find(p => String(p.id) === String(savedProjectId));
        if (project) {
          setSelectedProject(project);
        } else if (projectList.length > 0) {
          setSelectedProject(projectList[0]);
          localStorage.setItem('eclipay_selected_project', String(projectList[0].id));
        }
      } else if (projectList.length > 0) {
        setSelectedProject(projectList[0]);
        localStorage.setItem('eclipay_selected_project', String(projectList[0].id));
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setIsCreatingProject(true);
    try {
      const { project } = await projectsApi.create({
        name: projectName,
        webhookUrl: webhookUrl.trim() || undefined,
        environment: projectEnvironment,
      });
      
      setProjects(prev => [...prev, project]);
      setSelectedProject(project);
      localStorage.setItem('eclipay_selected_project', String(project.id));
      
      // Reset form and close modal
      setProjectName('');
      setWebhookUrl('');
      setProjectEnvironment('testnet');
      setShowCreateProject(false);
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    localStorage.setItem('eclipay_selected_project', String(project.id));
  };

  const renderPage = () => {
    if (!selectedProject) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <h2 className="text-xl font-semibold text-white mb-4">No Project Selected</h2>
          <p className="text-gray-400 mb-6 text-center">
            Create your first project to start accepting payments
          </p>
          <button
            onClick={() => setShowCreateProject(true)}
            className="btn-primary flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Project
          </button>
        </div>
      );
    }

    switch (currentPage) {
      case 'dashboard':
        return <DashboardOverview projectId={selectedProject.id} environment={selectedProject.environment} />;
      case 'wallets':
        return <WalletsPage projectId={selectedProject.id} />;
      case 'transactions':
        return <TransactionsPage projectId={selectedProject.id} />;
      case 'invoices':
        return <InvoicesPage projectId={selectedProject.id} />;
      case 'settings':
        return <SettingsPage project={selectedProject} user={user} onProjectUpdate={loadProjects} />;
      case 'docs':
        return <ApiDocsPage projectId={selectedProject.id} />;
      default:
        return <DashboardOverview projectId={selectedProject.id} environment={selectedProject.environment} />;
    }
  };

  if (isLoadingProjects) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Mobile sidebar */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setSidebarOpen(false)} />
        <div
          className={`absolute left-0 top-0 h-full w-64 bg-slate-800 transition-transform duration-300 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <div className="flex items-center">
              <span className="text-2xl mr-2">💳</span>
              <span className="text-xl font-bold text-white">EcliPay</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          {/* Mobile Project Selector - Moved to top */}
          <div className="border-b border-slate-700 p-4">
            <div className="text-sm text-gray-400 mb-2">Current Project</div>
            {selectedProject ? (
              <div className="relative">
                <button
                  onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                  className="w-full flex items-center justify-between bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white hover:bg-slate-600 transition-colors"
                >
                  <div className="flex items-center min-w-0">
                    <span className="truncate">{selectedProject.name}</span>
                    <span className={`ml-2 px-2 py-1 text-xs rounded flex-shrink-0 ${
                      selectedProject.environment === 'testnet' 
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' 
                        : 'bg-green-500/20 text-green-300 border border-green-500/30'
                    }`}>
                      {selectedProject.environment?.toUpperCase() || 'TESTNET'}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
                </button>
                
                {showProjectDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-700 border border-slate-600 rounded-md shadow-lg max-h-48 overflow-y-auto z-50">
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setShowCreateProject(true);
                          setShowProjectDropdown(false);
                          setSidebarOpen(false);
                        }}
                        className="w-full flex items-center px-3 py-2 text-sm text-primary-400 hover:bg-slate-600 rounded"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create New Project
                      </button>
                    </div>
                    <div className="border-t border-slate-600"></div>
                    <div className="p-2">
                      {projects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => {
                            handleSelectProject(project);
                            setShowProjectDropdown(false);
                            setSidebarOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                            selectedProject?.id === project.id
                              ? 'bg-primary-600 text-white'
                              : 'text-gray-300 hover:bg-slate-600 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">{project.name}</span>
                            <span className={`ml-2 px-1 py-0.5 text-xs rounded flex-shrink-0 ${
                              project.environment === 'testnet' 
                                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' 
                                : 'bg-green-500/20 text-green-300 border border-green-500/30'
                            }`}>
                              {project.environment?.toUpperCase() || 'TESTNET'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  setShowCreateProject(true);
                  setSidebarOpen(false);
                }}
                className="w-full flex items-center justify-center bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded text-sm transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </button>
            )}
          </div>

          <nav className="flex-1 px-2 py-4 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    setCurrentPage(item.page);
                    setSidebarOpen(false);
                  }}
                  className={`sidebar-link w-full text-left ${
                    currentPage === item.page ? 'active' : ''
                  }`}
                >
                  <Icon className="mr-3 h-6 w-6" />
                  {item.name}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-slate-700 p-4">
            
            <div className="text-sm text-gray-400 mb-2">
              Logged in as
            </div>
            <div className="text-sm font-medium text-white mb-4">
              {user.username}
            </div>
            <button
              onClick={onLogout}
              className="sidebar-link w-full text-left text-red-400 hover:text-red-300 hover:bg-red-900/20"
            >
              <LogOut className="mr-3 h-6 w-6" />
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex flex-col flex-grow bg-slate-800 border-r border-slate-700">
          <div className="flex items-center px-4 py-6 border-b border-slate-700">
            <span className="text-2xl mr-2">💳</span>
            <span className="text-xl font-bold text-white">EcliPay</span>
          </div>
          
          <div className="flex-1 flex flex-col overflow-y-auto">
            {/* Desktop Project Selector - Moved to top */}
            <div className="border-b border-slate-700 p-4">
              <div className="text-sm text-gray-400 mb-2">Current Project</div>
              {selectedProject ? (
                <div className="relative">
                  <button
                    onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                    className="w-full flex items-center justify-between bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white hover:bg-slate-600 transition-colors"
                  >
                    <div className="flex items-center min-w-0">
                      <span className="truncate">{selectedProject.name}</span>
                      <span className={`ml-2 px-2 py-1 text-xs rounded flex-shrink-0 ${
                        selectedProject.environment === 'testnet' 
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' 
                          : 'bg-green-500/20 text-green-300 border border-green-500/30'
                      }`}>
                        {selectedProject.environment?.toUpperCase() || 'TESTNET'}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
                  </button>
                  
                  {showProjectDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-700 border border-slate-600 rounded-md shadow-lg max-h-48 overflow-y-auto z-50">
                      <div className="p-2">
                        <button
                          onClick={() => {
                            setShowCreateProject(true);
                            setShowProjectDropdown(false);
                          }}
                          className="w-full flex items-center px-3 py-2 text-sm text-primary-400 hover:bg-slate-600 rounded"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create New Project
                        </button>
                      </div>
                      <div className="border-t border-slate-600"></div>
                      <div className="p-2">
                        {projects.map((project) => (
                          <button
                            key={project.id}
                            onClick={() => {
                              handleSelectProject(project);
                              setShowProjectDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                              selectedProject?.id === project.id
                                ? 'bg-primary-600 text-white'
                                : 'text-gray-300 hover:bg-slate-600 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate">{project.name}</span>
                              <span className={`ml-2 px-1 py-0.5 text-xs rounded flex-shrink-0 ${
                                project.environment === 'testnet' 
                                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' 
                                  : 'bg-green-500/20 text-green-300 border border-green-500/30'
                              }`}>
                                {project.environment?.toUpperCase() || 'TESTNET'}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateProject(true)}
                  className="w-full flex items-center justify-center bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded text-sm transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </button>
              )}
            </div>

            <nav className="flex-1 px-2 py-4 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => setCurrentPage(item.page)}
                    className={`sidebar-link w-full text-left ${
                      currentPage === item.page ? 'active' : ''
                    }`}
                  >
                    <Icon className="mr-3 h-6 w-6" />
                    {item.name}
                  </button>
                );
              })}
            </nav>
            
            <div className="border-t border-slate-700 p-4">
              
              <div className="text-sm text-gray-400 mb-2">
                Logged in as
              </div>
              <div className="text-sm font-medium text-white mb-4">
                {user.username}
              </div>
              <button
                onClick={onLogout}
                className="sidebar-link w-full text-left text-red-400 hover:text-red-300 hover:bg-red-900/20"
              >
                <LogOut className="mr-3 h-6 w-6" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="flex items-center justify-between bg-slate-800 border-b border-slate-700 px-4 py-3 lg:px-6">
          <div className="flex items-center">
            <button
              className="lg:hidden text-gray-400 hover:text-white mr-3"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-semibold text-white capitalize">
              {currentPage}
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden md:block text-sm text-gray-400">
              {selectedProject ? selectedProject.name : 'No Project'} • {user.username}
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {renderPage()}
        </main>
      </div>

      {/* Create Project Modal */}
      {showCreateProject && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div 
              className="fixed inset-0 bg-black opacity-50"
              onClick={() => setShowCreateProject(false)}
            ></div>
            <div className="relative bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Create New Project</h3>
              
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="input-field w-full rounded-md"
                    placeholder="My Payment Gateway"
                    disabled={isCreatingProject}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Environment *
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      type="button"
                      onClick={() => setProjectEnvironment('testnet')}
                      disabled={isCreatingProject}
                      className={`p-4 rounded-lg border-2 text-left transition-colors ${
                        projectEnvironment === 'testnet'
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-slate-600 bg-slate-700/50 hover:border-orange-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-white">Testnet</h4>
                        <span className="px-2 py-1 text-xs bg-orange-500 text-white rounded">
                          Recommended
                        </span>
                      </div>
                      <p className="text-sm text-gray-300">
                        For testing and development. Use test tokens only.
                      </p>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setProjectEnvironment('mainnet')}
                      disabled={isCreatingProject}
                      className={`p-4 rounded-lg border-2 text-left transition-colors ${
                        projectEnvironment === 'mainnet'
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-slate-600 bg-slate-700/50 hover:border-green-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-white">Mainnet</h4>
                        <span className="px-2 py-1 text-xs bg-red-500 text-white rounded">
                          Live
                        </span>
                      </div>
                      <p className="text-sm text-gray-300">
                        Production environment. Real funds will be used.
                      </p>
                    </button>
                  </div>
                  {projectEnvironment === 'mainnet' && (
                    <div className="mt-2 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                      <p className="text-sm text-red-300">
                        ⚠️ <strong>Warning:</strong> Mainnet uses real cryptocurrency. Make sure you understand the risks before proceeding.
                      </p>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Webhook URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="input-field w-full rounded-md"
                    placeholder="https://your-site.com/webhook"
                    disabled={isCreatingProject}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    URL to receive payment notifications
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateProject(false)}
                    className="btn-secondary"
                    disabled={isCreatingProject}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    disabled={isCreatingProject || !projectName.trim()}
                  >
                    {isCreatingProject ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    {isCreatingProject ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}