import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import * as authApi from '../api/auth';

vi.mock('../api/auth', () => ({
  config: vi.fn().mockResolvedValue({ googleEnabled: false }),
  login: vi.fn(),
  register: vi.fn(),
}));

const mockLogin = vi.fn();
const mockRegister = vi.fn();
vi.mock('../store/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, register: mockRegister }),
}));

const Wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;

describe('LoginPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('affiche les onglets Connexion et Inscription', () => {
    render(<LoginPage />, { wrapper: Wrapper });
    expect(screen.getByText('Connexion')).toBeInTheDocument();
    expect(screen.getByText('Inscription')).toBeInTheDocument();
  });

  it('soumet le formulaire de connexion', async () => {
    mockLogin.mockResolvedValue({ _id: '1', username: 'alice' });
    render(<LoginPage />, { wrapper: Wrapper });

    await userEvent.type(screen.getByLabelText("Nom d'utilisateur"), 'alice');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'pass1234');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith({ username: 'alice', password: 'pass1234' })
    );
  });

  it("bascule vers l'onglet inscription et change le bouton submit", async () => {
    render(<LoginPage />, { wrapper: Wrapper });
    await userEvent.click(screen.getByText('Inscription'));
    expect(screen.getByRole('button', { name: "S'inscrire" })).toBeInTheDocument();
  });

  it("n'affiche pas le bouton Google si googleEnabled est false", async () => {
    render(<LoginPage />, { wrapper: Wrapper });
    await waitFor(() => expect(authApi.config).toHaveBeenCalled());
    expect(screen.queryByText('Continuer avec Google')).not.toBeInTheDocument();
  });

  it('affiche le bouton Google si googleEnabled est true', async () => {
    authApi.config.mockResolvedValue({ googleEnabled: true });
    render(<LoginPage />, { wrapper: Wrapper });
    await waitFor(() =>
      expect(screen.getByText('Continuer avec Google')).toBeInTheDocument()
    );
  });
});
