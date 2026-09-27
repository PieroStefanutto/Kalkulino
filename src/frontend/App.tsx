import { useEffect, useMemo, useState } from 'react';

type User = {
  id: string;
  email: string;
  betriebId: string;
  role: string;
};

type Ingredient = {
  id: string;
  name: string;
  einkaufsmenge: number;
  einkaufspreis_netto: number;
  einheit: string;
};

type Recipe = {
  id: string;
  name: string;
  portionsgroesse: number;
  ist_unterrezept: boolean;
};

type CalculationChannel = {
  kanal: {
    id: string;
    name: string;
  };
  mindestpreis_netto: number;
  empfohlener_preis_netto: number;
  preis_brutto: number;
  db: number;
  db_quote: number;
};

type CalculationResult = {
  wareneinsatz: number;
  personalkosten: number;
  fixkosten_anteil: number;
  selbstkosten: number;
  je_kanal: CalculationChannel[];
};

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('kalkulino_token');

  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? 'Anfrage fehlgeschlagen.');
  }

  return payload as T;
}

export default function App() {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('demo@kalkulino.de');
  const [password, setPassword] = useState('demo123');
  const [betriebName, setBetriebName] = useState('Demo Betrieb');
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('kalkulino_token'));
  const [user, setUser] = useState<User | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null,
    [recipes, selectedRecipeId],
  );

  const fetchSessionData = async () => {
    const [ingredientData, recipeData] = await Promise.all([
      apiFetch<{ items: Ingredient[] }>('/zutaten'),
      apiFetch<{ items: Recipe[] }>('/rezepte'),
    ]);

    setIngredients(ingredientData.items ?? []);
    setRecipes(recipeData.items ?? []);

    if (recipeData.items?.length) {
      setSelectedRecipeId((current) => current || recipeData.items[0].id);
    }
  };

  const fetchCurrentUser = async () => {
    const response = await apiFetch<{ user: User }>('/auth/me');
    setUser(response.user);
  };

  const fetchCalculation = async (recipeId: string) => {
    if (!recipeId) {
      setCalculation(null);
      return;
    }

    const response = await apiFetch<{ kalkulation: CalculationResult }>(`/rezepte/${recipeId}/kalkulation`);
    setCalculation(response.kalkulation);
  };

  useEffect(() => {
    if (!token) {
      setUser(null);
      setIngredients([]);
      setRecipes([]);
      setSelectedRecipeId('');
      setCalculation(null);
      return;
    }

    const initialize = async () => {
      try {
        setLoading(true);
        await fetchCurrentUser();
        await fetchSessionData();
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Sitzung konnte nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    };

    void initialize();
  }, [token]);

  useEffect(() => {
    if (!selectedRecipeId || !token) {
      return;
    }

    const loadCalculation = async () => {
      try {
        await fetchCalculation(selectedRecipeId);
      } catch (calcError) {
        setError(calcError instanceof Error ? calcError.message : 'Kalkulation konnte nicht geladen werden.');
      }
    };

    void loadCalculation();
  }, [selectedRecipeId, token]);

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = mode === 'register' ? '/auth/register' : '/auth/login';
      const payload = await apiFetch<{ token: string; user: User }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(
          mode === 'register'
            ? { email, password, betriebName }
            : { email, password },
        ),
      });

      localStorage.setItem('kalkulino_token', payload.token);
      setToken(payload.token);
      setUser(payload.user);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentifizierung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('kalkulino_token');
    setToken(null);
    setUser(null);
    setIngredients([]);
    setRecipes([]);
    setSelectedRecipeId('');
    setCalculation(null);
  };

  if (!token || !user) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="brand-row">
            <div className="brand-mark">K</div>
            <div>
              <p className="eyebrow">Gastro pricing MVP</p>
              <h1>Kalkulino</h1>
            </div>
          </div>

          <div className="toggle-row">
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => setMode('register')}
            >
              Registrieren
            </button>
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => setMode('login')}
            >
              Anmelden
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="auth-form">
            {mode === 'register' && (
              <label>
                Betrieb
                <input value={betriebName} onChange={(event) => setBetriebName(event.target.value)} />
              </label>
            )}

            <label>
              E-Mail
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>

            <label>
              Passwort
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>

            {error && <p className="error-box">{error}</p>}

            <button type="submit" disabled={loading} className="primary-button">
              {loading ? 'Bitte warten...' : mode === 'register' ? 'Account erstellen' : 'Einloggen'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Betrieb</p>
          <h2>{user.email}</h2>
        </div>

        <button type="button" className="ghost-button" onClick={handleLogout}>
          Abmelden
        </button>
      </header>

      {error && <div className="alert-box">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <span>Aktive Zutaten</span>
          <strong>{ingredients.length}</strong>
        </div>
        <div className="stat-card">
          <span>Rezepte</span>
          <strong>{recipes.length}</strong>
        </div>
        <div className="stat-card">
          <span>Selbstkosten</span>
          <strong>{calculation ? `€ ${calculation.selbstkosten.toFixed(2)}` : '—'}</strong>
        </div>
      </div>

      <div className="layout-grid">
        <aside className="panel">
          <h3>Rezepte</h3>
          <div className="list-stack">
            {recipes.map((recipe) => (
              <button
                key={recipe.id}
                type="button"
                className={selectedRecipeId === recipe.id ? 'recipe-item active' : 'recipe-item'}
                onClick={() => setSelectedRecipeId(recipe.id)}
              >
                <span>{recipe.name}</span>
                <small>{recipe.portionsgroesse} Portionen</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel main-panel">
          {selectedRecipe ? (
            <>
              <div className="section-header">
                <div>
                  <p className="eyebrow">Ausgewähltes Rezept</p>
                  <h3>{selectedRecipe.name}</h3>
                </div>
                <span className="badge">{selectedRecipe.portionsgroesse} Portionen</span>
              </div>

              {calculation ? (
                <div className="kalkulation-block">
                  <div className="summary-grid">
                    <div>
                      <span>Wareneinsatz</span>
                      <strong>€ {calculation.wareneinsatz.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span>Personalkosten</span>
                      <strong>€ {calculation.personalkosten.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span>Fixkostenanteil</span>
                      <strong>€ {calculation.fixkosten_anteil.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span>Selbstkosten</span>
                      <strong>€ {calculation.selbstkosten.toFixed(2)}</strong>
                    </div>
                  </div>

                  <div className="channel-table">
                    <div className="channel-header">
                      <span>Kanal</span>
                      <span>Preis</span>
                      <span>DB</span>
                      <span>DB %</span>
                    </div>

                    {calculation.je_kanal.map((channel) => (
                      <div key={channel.kanal.id} className="channel-row">
                        <span>{channel.kanal.name}</span>
                        <span>€ {channel.empfohlener_preis_netto.toFixed(2)}</span>
                        <span>€ {channel.db.toFixed(2)}</span>
                        <span>{(channel.db_quote * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p>Die Kalkulation wird geladen...</p>
              )}
            </>
          ) : (
            <p>Bitte ein Rezept auswählen.</p>
          )}
        </section>

        <aside className="panel">
          <h3>Zutaten</h3>
          <div className="list-stack compact">
            {ingredients.map((ingredient) => (
              <div key={ingredient.id} className="ingredient-item">
                <span>{ingredient.name}</span>
                <small>
                  {ingredient.einkaufspreis_netto.toFixed(2)} €/ {ingredient.einheit}
                </small>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
