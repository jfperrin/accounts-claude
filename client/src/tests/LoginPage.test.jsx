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

  it('soumet le formulaire de connexion avec email', async () => {
    mockLogin.mockResolvedValue({ _id: '1', email: 'alice@test.com' });
    render(<LoginPage />, { wrapper: Wrapper });

    await userEvent.type(screen.getByLabelText('Adresse email'), 'alice@test.com');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'pass1234');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'alice@test.com',
        password: 'pass1234',
        rememberDays: 30,
      })
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

  it('affiche le sélecteur de durée uniquement sur l\'onglet connexion', () => {
    render(<LoginPage />, { wrapper: Wrapper });
    expect(screen.getByRole('button', { name: '1 jour' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 mois' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 an' })).toBeInTheDocument();
  });

  it('n\'affiche pas le sélecteur de durée sur l\'onglet inscription', async () => {
    render(<LoginPage />, { wrapper: Wrapper });
    await userEvent.click(screen.getByText('Inscription'));
    expect(screen.queryByRole('button', { name: '1 jour' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '1 mois' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '1 an' })).not.toBeInTheDocument();
  });

  it('envoie rememberDays=1 quand "1 jour" est sélectionné', async () => {
    mockLogin.mockResolvedValue({ _id: '1', email: 'alice@test.com' });
    render(<LoginPage />, { wrapper: Wrapper });

    await userEvent.type(screen.getByLabelText('Adresse email'), 'alice@test.com');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'pass1234');
    await userEvent.click(screen.getByRole('button', { name: '1 jour' }));
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'alice@test.com',
        password: 'pass1234',
        rememberDays: 1,
      })
    );
  });

  it('envoie rememberDays=365 quand "1 an" est sélectionné', async () => {
    mockLogin.mockResolvedValue({ _id: '1', email: 'alice@test.com' });
    render(<LoginPage />, { wrapper: Wrapper });

    await userEvent.type(screen.getByLabelText('Adresse email'), 'alice@test.com');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'pass1234');
    await userEvent.click(screen.getByRole('button', { name: '1 an' }));
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'alice@test.com',
        password: 'pass1234',
        rememberDays: 365,
      })
    );
  });
});
