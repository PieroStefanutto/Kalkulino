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
  verkaufspreis_netto?: number | null;
};

type RecipeLine = {
  id: string;
  rezeptId: string;
  zutatId?: string | null;
  unterrezeptId?: string | null;
  menge: number;
  verschnitt_pct: number;
  garverlust_pct: number;
  schwund_pct: number;
};

type RecipeWorkEntry = {
  id: string;
  rezeptId: string;
  personalkategorie_id: string;
  vorbereitung_min: number;
  produktion_min: number;
  anrichten_min: number;
  batch_groesse: number;
};

type RecipeDetail = {
  id: string;
  name: string;
  portionsgroesse: number;
  ist_unterrezept: boolean;
  verkaufspreis_netto?: number | null;
  ingredients: RecipeLine[];
  arbeitszeit: RecipeWorkEntry[];
};

type FixedCost = {
  id: string;
  kategorie: string;
  betrag_monat: number;
  gueltig_ab: string;
};

type SalesEntry = {
  id: string;
  monat: string;
  gaeste?: number | null;
  verkaufte_speisen?: number | null;
  oe_bon?: number | null;
};

type LaborCategory = {
  id: string;
  bezeichnung: string;
  stundensatz_ag_gesamt: number;
};

type TaxRate = {
  id: string;
  bezeichnung: string;
  satz_pct: number;
};

type SalesChannel = {
  id: string;
  name: string;
  provision_pct: number;
  kartengebuehr_pct: number;
  verpackungskosten: number;
  steuersatz_id?: string | null;
};

type Goal = {
  id: string;
  ziel_typ: 'db_quote' | 'gewinn_eur';
  wert: number;
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
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [salesEntries, setSalesEntries] = useState<SalesEntry[]>([]);
  const [laborCategories, setLaborCategories] = useState<LaborCategory[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [salesChannels, setSalesChannels] = useState<SalesChannel[]>([]);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [ingredientForm, setIngredientForm] = useState({
    name: '',
    einkaufsmenge: '1',
    einkaufspreis_netto: '0',
    einheit: 'kg',
  });
  const [ingredientEditId, setIngredientEditId] = useState<string | null>(null);

  const [recipeForm, setRecipeForm] = useState({
    name: '',
    portionsgroesse: '1',
    ist_unterrezept: false,
    verkaufspreis_netto: '',
  });
  const [recipeEditId, setRecipeEditId] = useState<string | null>(null);

  const [fixedCostForm, setFixedCostForm] = useState({
    kategorie: 'Miete',
    betrag_monat: '0',
    gueltig_ab: new Date().toISOString().slice(0, 10),
  });

  const [salesForm, setSalesForm] = useState({
    monat: new Date().toISOString().slice(0, 7),
    gaeste: '0',
    verkaufte_speisen: '0',
    oe_bon: '0',
  });

  const [laborForm, setLaborForm] = useState({
    bezeichnung: 'Koch',
    stundensatz_ag_gesamt: '30',
  });

  const [taxForm, setTaxForm] = useState({
    bezeichnung: 'Mehrwertsteuer',
    satz_pct: '19',
  });

  const [channelForm, setChannelForm] = useState({
    name: 'Lieferung',
    provision_pct: '12',
    kartengebuehr_pct: '2',
    verpackungskosten: '0',
    steuersatz_id: '',
  });

  const [goalForm, setGoalForm] = useState({
    ziel_typ: 'db_quote',
    wert: '35',
  });

  const [selectedRecipeDetail, setSelectedRecipeDetail] = useState<RecipeDetail | null>(null);
  const [recipeLineEditId, setRecipeLineEditId] = useState<string | null>(null);
  const [recipeLineForm, setRecipeLineForm] = useState({
    targetType: 'zutat' as 'zutat' | 'unterrezept',
    targetId: '',
    menge: '1',
    verschnitt_pct: '0',
    garverlust_pct: '0',
    schwund_pct: '0',
  });
  const [workEntryEditId, setWorkEntryEditId] = useState<string | null>(null);
  const [workEntryForm, setWorkEntryForm] = useState({
    personalkategorie_id: '',
    vorbereitung_min: '0',
    produktion_min: '0',
    anrichten_min: '0',
    batch_groesse: '1',
  });

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null,
    [recipes, selectedRecipeId],
  );

  const recipeLineTargets = useMemo(
    () =>
      recipeLineForm.targetType === 'zutat'
        ? ingredients.map((ingredient) => ({ id: ingredient.id, label: ingredient.name }))
        : recipes
            .filter((recipe) => recipe.id !== selectedRecipeId)
            .map((recipe) => ({ id: recipe.id, label: recipe.name })),
    [ingredients, recipeLineForm.targetType, recipes, selectedRecipeId],
  );

  const fetchRecipeDetail = async (recipeId: string) => {
    const response = await apiFetch<{ recipe: RecipeDetail }>(`/rezepte/${recipeId}`);
    setSelectedRecipeDetail(response.recipe);
    if (!response.recipe?.arbeitszeit?.length && laborCategories.length) {
      setWorkEntryForm((current) => ({
        ...current,
        personalkategorie_id: current.personalkategorie_id || laborCategories[0].id,
      }));
    }
  };

  const resetRecipeLineForm = () => {
    setRecipeLineEditId(null);
    setRecipeLineForm({
      targetType: 'zutat',
      targetId: '',
      menge: '1',
      verschnitt_pct: '0',
      garverlust_pct: '0',
      schwund_pct: '0',
    });
  };

  const resetWorkEntryForm = () => {
    setWorkEntryEditId(null);
    setWorkEntryForm({
      personalkategorie_id: laborCategories[0]?.id ?? '',
      vorbereitung_min: '0',
      produktion_min: '0',
      anrichten_min: '0',
      batch_groesse: '1',
    });
  };

  const fetchSessionData = async () => {
    const [ingredientData, recipeData, fixedCostData, salesData, laborData, taxData, channelData, goalData] =
      await Promise.all([
        apiFetch<{ items: Ingredient[] }>('/zutaten'),
        apiFetch<{ items: Recipe[] }>('/rezepte'),
        apiFetch<{ items: FixedCost[] }>('/fixkosten'),
        apiFetch<{ items: SalesEntry[] }>('/auslastung'),
        apiFetch<{ items: LaborCategory[] }>('/personalkategorien'),
        apiFetch<{ items: TaxRate[] }>('/steuersaetze'),
        apiFetch<{ items: SalesChannel[] }>('/verkaufskanaele'),
        apiFetch<{ item: Goal | null }>('/ziel'),
      ]);

    setIngredients(ingredientData.items ?? []);
    setRecipes(recipeData.items ?? []);
    setFixedCosts(fixedCostData.items ?? []);
    setSalesEntries(salesData.items ?? []);
    setLaborCategories(laborData.items ?? []);
    setTaxRates(taxData.items ?? []);
    setSalesChannels(channelData.items ?? []);
    setGoal(goalData.item ?? null);

    if (goalData.item) {
      setGoalForm({
        ziel_typ: goalData.item.ziel_typ,
        wert: String(goalData.item.wert),
      });
    }

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
      setFixedCosts([]);
      setSalesEntries([]);
      setLaborCategories([]);
      setTaxRates([]);
      setSalesChannels([]);
      setGoal(null);
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
      setSelectedRecipeDetail(null);
      return;
    }

    const loadDetail = async () => {
      try {
        await fetchRecipeDetail(selectedRecipeId);
      } catch (detailError) {
        setError(detailError instanceof Error ? detailError.message : 'Rezeptdetails konnten nicht geladen werden.');
      }
    };

    void loadDetail();
  }, [selectedRecipeId, token, laborCategories.length]);

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

  const resetIngredientForm = () => {
    setIngredientForm({
      name: '',
      einkaufsmenge: '1',
      einkaufspreis_netto: '0',
      einheit: 'kg',
    });
    setIngredientEditId(null);
  };

  const resetRecipeForm = () => {
    setRecipeForm({
      name: '',
      portionsgroesse: '1',
      ist_unterrezept: false,
      verkaufspreis_netto: '',
    });
    setRecipeEditId(null);
  };

  const handleIngredientSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const body = {
        name: ingredientForm.name,
        einkaufsmenge: Number(ingredientForm.einkaufsmenge),
        einkaufspreis_netto: Number(ingredientForm.einkaufspreis_netto),
        einheit: ingredientForm.einheit,
      };

      if (ingredientEditId) {
        await apiFetch(`/zutaten/${ingredientEditId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch('/zutaten', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }

      resetIngredientForm();
      await fetchSessionData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Zutat konnte nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIngredient = async (ingredientId: string) => {
    try {
      setError('');
      await apiFetch(`/zutaten/${ingredientId}`, { method: 'DELETE' });
      await fetchSessionData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Zutat konnte nicht gelöscht werden.');
    }
  };

  const handleRecipeSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const body = {
        name: recipeForm.name,
        portionsgroesse: Number(recipeForm.portionsgroesse),
        ist_unterrezept: recipeForm.ist_unterrezept,
        verkaufspreis_netto: recipeForm.verkaufspreis_netto === '' ? null : Number(recipeForm.verkaufspreis_netto),
      };

      if (recipeEditId) {
        await apiFetch(`/rezepte/${recipeEditId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch('/rezepte', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }

      resetRecipeForm();
      await fetchSessionData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Rezept konnte nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    try {
      setError('');
      await apiFetch(`/rezepte/${recipeId}`, { method: 'DELETE' });
      await fetchSessionData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Rezept konnte nicht gelöscht werden.');
    }
  };

  const handleFixedCostSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    try {
      await apiFetch('/fixkosten', {
        method: 'POST',
        body: JSON.stringify({
          kategorie: fixedCostForm.kategorie,
          betrag_monat: Number(fixedCostForm.betrag_monat),
          gueltig_ab: fixedCostForm.gueltig_ab,
        }),
      });

      setFixedCostForm({
        kategorie: 'Miete',
        betrag_monat: '0',
        gueltig_ab: new Date().toISOString().slice(0, 10),
      });
      await fetchSessionData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Fixkosten konnten nicht gespeichert werden.');
    }
  };

  const handleSalesSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    try {
      await apiFetch('/auslastung', {
        method: 'POST',
        body: JSON.stringify({
          monat: salesForm.monat,
          gaeste: Number(salesForm.gaeste),
          verkaufte_speisen: Number(salesForm.verkaufte_speisen),
          oe_bon: Number(salesForm.oe_bon),
        }),
      });

      setSalesForm({
        monat: new Date().toISOString().slice(0, 7),
        gaeste: '0',
        verkaufte_speisen: '0',
        oe_bon: '0',
      });
      await fetchSessionData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Auslastung konnte nicht gespeichert werden.');
    }
  };

  const handleLaborSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    try {
      await apiFetch('/personalkategorien', {
        method: 'POST',
        body: JSON.stringify({
          bezeichnung: laborForm.bezeichnung,
          stundensatz_ag_gesamt: Number(laborForm.stundensatz_ag_gesamt),
        }),
      });

      setLaborForm({
        bezeichnung: 'Koch',
        stundensatz_ag_gesamt: '30',
      });
      await fetchSessionData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Personalkategorie konnte nicht gespeichert werden.');
    }
  };

  const handleTaxSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    try {
      await apiFetch('/steuersaetze', {
        method: 'POST',
        body: JSON.stringify({
          bezeichnung: taxForm.bezeichnung,
          satz_pct: Number(taxForm.satz_pct),
        }),
      });

      setTaxForm({
        bezeichnung: 'Mehrwertsteuer',
        satz_pct: '19',
      });
      await fetchSessionData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Steuersatz konnte nicht gespeichert werden.');
    }
  };

  const handleChannelSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    try {
      await apiFetch('/verkaufskanaele', {
        method: 'POST',
        body: JSON.stringify({
          name: channelForm.name,
          provision_pct: Number(channelForm.provision_pct),
          kartengebuehr_pct: Number(channelForm.kartengebuehr_pct),
          verpackungskosten: Number(channelForm.verpackungskosten),
          steuersatz_id: channelForm.steuersatz_id || null,
        }),
      });

      setChannelForm({
        name: 'Lieferung',
        provision_pct: '12',
        kartengebuehr_pct: '2',
        verpackungskosten: '0',
        steuersatz_id: '',
      });
      await fetchSessionData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Verkaufskanal konnte nicht gespeichert werden.');
    }
  };

  const handleGoalSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    try {
      await apiFetch('/ziel', {
        method: 'PUT',
        body: JSON.stringify({
          ziel_typ: goalForm.ziel_typ,
          wert: Number(goalForm.wert),
        }),
      });

      await fetchSessionData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Ziel konnte nicht gespeichert werden.');
    }
  };

  const refreshSelectedRecipe = async () => {
    if (!selectedRecipeId) {
      return;
    }

    await fetchRecipeDetail(selectedRecipeId);
    await fetchCalculation(selectedRecipeId);
  };

  const handleRecipeLineSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRecipeId) {
      return;
    }

    setError('');

    try {
      const payload = {
        zutatId: recipeLineForm.targetType === 'zutat' ? recipeLineForm.targetId : undefined,
        unterrezeptId: recipeLineForm.targetType === 'unterrezept' ? recipeLineForm.targetId : undefined,
        menge: Number(recipeLineForm.menge),
        verschnitt_pct: Number(recipeLineForm.verschnitt_pct),
        garverlust_pct: Number(recipeLineForm.garverlust_pct),
        schwund_pct: Number(recipeLineForm.schwund_pct),
      };

      if (recipeLineEditId) {
        await apiFetch(`/rezepte/${selectedRecipeId}/zutaten/${recipeLineEditId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/rezepte/${selectedRecipeId}/zutaten`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      resetRecipeLineForm();
      await refreshSelectedRecipe();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Rezeptbestandteil konnte nicht gespeichert werden.');
    }
  };

  const handleDeleteRecipeLine = async (lineId: string) => {
    if (!selectedRecipeId) {
      return;
    }

    try {
      setError('');
      await apiFetch(`/rezepte/${selectedRecipeId}/zutaten/${lineId}`, { method: 'DELETE' });
      if (recipeLineEditId === lineId) {
        resetRecipeLineForm();
      }
      await refreshSelectedRecipe();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Rezeptbestandteil konnte nicht gelöscht werden.');
    }
  };

  const handleWorkEntrySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRecipeId) {
      return;
    }

    setError('');

    try {
      const payload = {
        personalkategorie_id: workEntryForm.personalkategorie_id,
        vorbereitung_min: Number(workEntryForm.vorbereitung_min),
        produktion_min: Number(workEntryForm.produktion_min),
        anrichten_min: Number(workEntryForm.anrichten_min),
        batch_groesse: Number(workEntryForm.batch_groesse),
      };

      if (workEntryEditId) {
        await apiFetch(`/rezepte/${selectedRecipeId}/arbeitszeit/${workEntryEditId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/rezepte/${selectedRecipeId}/arbeitszeit`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      resetWorkEntryForm();
      await refreshSelectedRecipe();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Arbeitszeit konnte nicht gespeichert werden.');
    }
  };

  const handleDeleteWorkEntry = async (entryId: string) => {
    if (!selectedRecipeId) {
      return;
    }

    try {
      setError('');
      await apiFetch(`/rezepte/${selectedRecipeId}/arbeitszeit/${entryId}`, { method: 'DELETE' });
      if (workEntryEditId === entryId) {
        resetWorkEntryForm();
      }
      await refreshSelectedRecipe();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Arbeitszeit konnte nicht gelöscht werden.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('kalkulino_token');
    setToken(null);
    setUser(null);
    setIngredients([]);
    setRecipes([]);
    setFixedCosts([]);
    setSalesEntries([]);
    setLaborCategories([]);
    setTaxRates([]);
    setSalesChannels([]);
    setGoal(null);
    setSelectedRecipeId('');
    setSelectedRecipeDetail(null);
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

              <div className="detail-stack">
                <div className="detail-panel">
                  <h4>Rezeptbestandteile</h4>
                  <form onSubmit={handleRecipeLineSubmit} className="form-stack compact-form">
                    <div className="two-col">
                      <label>
                        Typ
                        <select
                          value={recipeLineForm.targetType}
                          onChange={(event) =>
                            setRecipeLineForm((current) => ({
                              ...current,
                              targetType: event.target.value as 'zutat' | 'unterrezept',
                              targetId: '',
                            }))
                          }
                        >
                          <option value="zutat">Zutat</option>
                          <option value="unterrezept">Unterrezept</option>
                        </select>
                      </label>
                      <label>
                        {recipeLineForm.targetType === 'zutat' ? 'Zutat' : 'Unterrezept'}
                        <select
                          value={recipeLineForm.targetId}
                          onChange={(event) => setRecipeLineForm((current) => ({ ...current, targetId: event.target.value }))}
                          required
                        >
                          <option value="">Bitte wählen</option>
                          {recipeLineTargets.map((target) => (
                            <option key={target.id} value={target.id}>
                              {target.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="two-col">
                      <label>
                        Menge
                        <input
                          type="number"
                          step="0.01"
                          value={recipeLineForm.menge}
                          onChange={(event) => setRecipeLineForm((current) => ({ ...current, menge: event.target.value }))}
                          required
                        />
                      </label>
                      <label>
                        Verschnitt %
                        <input
                          type="number"
                          step="0.01"
                          value={recipeLineForm.verschnitt_pct}
                          onChange={(event) => setRecipeLineForm((current) => ({ ...current, verschnitt_pct: event.target.value }))}
                        />
                      </label>
                    </div>
                    <div className="two-col">
                      <label>
                        Garverlust %
                        <input
                          type="number"
                          step="0.01"
                          value={recipeLineForm.garverlust_pct}
                          onChange={(event) => setRecipeLineForm((current) => ({ ...current, garverlust_pct: event.target.value }))}
                        />
                      </label>
                      <label>
                        Schwund %
                        <input
                          type="number"
                          step="0.01"
                          value={recipeLineForm.schwund_pct}
                          onChange={(event) => setRecipeLineForm((current) => ({ ...current, schwund_pct: event.target.value }))}
                        />
                      </label>
                    </div>
                    <div className="button-row">
                      <button type="submit" className="primary-button small-button">
                        {recipeLineEditId ? 'Speichern' : 'Hinzufügen'}
                      </button>
                      {recipeLineEditId && (
                        <button type="button" className="ghost-button small-button" onClick={resetRecipeLineForm}>
                          Abbrechen
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="list-stack compact">
                    {(selectedRecipeDetail?.ingredients ?? []).map((line) => {
                      const label = line.zutatId
                        ? ingredients.find((ingredient) => ingredient.id === line.zutatId)?.name ?? 'Zutat'
                        : recipes.find((recipe) => recipe.id === line.unterrezeptId)?.name ?? 'Unterrezept';

                      return (
                        <div key={line.id} className="list-item-row">
                          <div>
                            <strong>{label}</strong>
                            <small>
                              {line.menge} · Verschnitt {line.verschnitt_pct}% · Garverlust {line.garverlust_pct}% · Schwund {line.schwund_pct}%
                            </small>
                          </div>
                          <div className="mini-actions">
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => {
                                setRecipeLineEditId(line.id);
                                setRecipeLineForm({
                                  targetType: line.zutatId ? 'zutat' : 'unterrezept',
                                  targetId: line.zutatId ?? line.unterrezeptId ?? '',
                                  menge: String(line.menge),
                                  verschnitt_pct: String(line.verschnitt_pct),
                                  garverlust_pct: String(line.garverlust_pct),
                                  schwund_pct: String(line.schwund_pct),
                                });
                              }}
                            >
                              Bearbeiten
                            </button>
                            <button type="button" className="danger-button" onClick={() => handleDeleteRecipeLine(line.id)}>
                              Entfernen
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="detail-panel">
                  <h4>Arbeitszeit</h4>
                  <form onSubmit={handleWorkEntrySubmit} className="form-stack compact-form">
                    <label>
                      Personalkategorie
                      <select
                        value={workEntryForm.personalkategorie_id}
                        onChange={(event) => setWorkEntryForm((current) => ({ ...current, personalkategorie_id: event.target.value }))}
                        required
                      >
                        <option value="">Bitte wählen</option>
                        {laborCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.bezeichnung}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="two-col">
                      <label>
                        Vorbereitung min
                        <input
                          type="number"
                          value={workEntryForm.vorbereitung_min}
                          onChange={(event) => setWorkEntryForm((current) => ({ ...current, vorbereitung_min: event.target.value }))}
                        />
                      </label>
                      <label>
                        Produktion min
                        <input
                          type="number"
                          value={workEntryForm.produktion_min}
                          onChange={(event) => setWorkEntryForm((current) => ({ ...current, produktion_min: event.target.value }))}
                        />
                      </label>
                    </div>
                    <div className="two-col">
                      <label>
                        Anrichten min
                        <input
                          type="number"
                          value={workEntryForm.anrichten_min}
                          onChange={(event) => setWorkEntryForm((current) => ({ ...current, anrichten_min: event.target.value }))}
                        />
                      </label>
                      <label>
                        Batchgröße
                        <input
                          type="number"
                          value={workEntryForm.batch_groesse}
                          onChange={(event) => setWorkEntryForm((current) => ({ ...current, batch_groesse: event.target.value }))}
                        />
                      </label>
                    </div>
                    <div className="button-row">
                      <button type="submit" className="primary-button small-button">
                        {workEntryEditId ? 'Speichern' : 'Hinzufügen'}
                      </button>
                      {workEntryEditId && (
                        <button type="button" className="ghost-button small-button" onClick={resetWorkEntryForm}>
                          Abbrechen
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="list-stack compact">
                    {(selectedRecipeDetail?.arbeitszeit ?? []).map((entry) => {
                      const category = laborCategories.find((labour) => labour.id === entry.personalkategorie_id);

                      return (
                        <div key={entry.id} className="list-item-row">
                          <div>
                            <strong>{category?.bezeichnung ?? 'Personalkategorie'}</strong>
                            <small>
                              Vor {entry.vorbereitung_min} · Prod {entry.produktion_min} · Anr {entry.anrichten_min} · Batch {entry.batch_groesse}
                            </small>
                          </div>
                          <div className="mini-actions">
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => {
                                setWorkEntryEditId(entry.id);
                                setWorkEntryForm({
                                  personalkategorie_id: entry.personalkategorie_id,
                                  vorbereitung_min: String(entry.vorbereitung_min),
                                  produktion_min: String(entry.produktion_min),
                                  anrichten_min: String(entry.anrichten_min),
                                  batch_groesse: String(entry.batch_groesse),
                                });
                              }}
                            >
                              Bearbeiten
                            </button>
                            <button type="button" className="danger-button" onClick={() => handleDeleteWorkEntry(entry.id)}>
                              Entfernen
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
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

      <div className="crud-grid">
        <section className="panel form-panel">
          <h3>Materialien</h3>
          <form onSubmit={handleIngredientSubmit} className="form-stack">
            <label>
              Name
              <input
                value={ingredientForm.name}
                onChange={(event) => setIngredientForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>
            <div className="two-col">
              <label>
                Menge
                <input
                  type="number"
                  step="0.01"
                  value={ingredientForm.einkaufsmenge}
                  onChange={(event) => setIngredientForm((current) => ({ ...current, einkaufsmenge: event.target.value }))}
                  required
                />
              </label>
              <label>
                Einheit
                <input
                  value={ingredientForm.einheit}
                  onChange={(event) => setIngredientForm((current) => ({ ...current, einheit: event.target.value }))}
                  required
                />
              </label>
            </div>
            <label>
              Einkaufspreis netto
              <input
                type="number"
                step="0.01"
                value={ingredientForm.einkaufspreis_netto}
                onChange={(event) => setIngredientForm((current) => ({ ...current, einkaufspreis_netto: event.target.value }))}
                required
              />
            </label>
            <div className="button-row">
              <button type="submit" className="primary-button">
                {ingredientEditId ? 'Speichern' : 'Hinzufügen'}
              </button>
              {ingredientEditId && (
                <button type="button" className="ghost-button" onClick={resetIngredientForm}>
                  Abbrechen
                </button>
              )}
            </div>
          </form>

          <div className="list-stack compact">
            {ingredients.map((ingredient) => (
              <div key={ingredient.id} className="list-item-row">
                <div>
                  <strong>{ingredient.name}</strong>
                  <small>
                    {ingredient.einkaufspreis_netto.toFixed(2)} €/ {ingredient.einheit}
                  </small>
                </div>
                <div className="mini-actions">
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setIngredientEditId(ingredient.id);
                      setIngredientForm({
                        name: ingredient.name,
                        einkaufsmenge: String(ingredient.einkaufsmenge),
                        einkaufspreis_netto: String(ingredient.einkaufspreis_netto),
                        einheit: ingredient.einheit,
                      });
                    }}
                  >
                    Bearbeiten
                  </button>
                  <button type="button" className="danger-button" onClick={() => handleDeleteIngredient(ingredient.id)}>
                    Löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel form-panel">
          <h3>Rezepte</h3>
          <form onSubmit={handleRecipeSubmit} className="form-stack">
            <label>
              Name
              <input
                value={recipeForm.name}
                onChange={(event) => setRecipeForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>
            <div className="two-col">
              <label>
                Portionen
                <input
                  type="number"
                  value={recipeForm.portionsgroesse}
                  onChange={(event) => setRecipeForm((current) => ({ ...current, portionsgroesse: event.target.value }))}
                  required
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={recipeForm.ist_unterrezept}
                  onChange={(event) => setRecipeForm((current) => ({ ...current, ist_unterrezept: event.target.checked }))}
                />
                Unterrezept
              </label>
            </div>
            <label>
              Verkaufspreis netto
              <input
                type="number"
                step="0.01"
                value={recipeForm.verkaufspreis_netto}
                onChange={(event) => setRecipeForm((current) => ({ ...current, verkaufspreis_netto: event.target.value }))}
              />
            </label>
            <div className="button-row">
              <button type="submit" className="primary-button">
                {recipeEditId ? 'Speichern' : 'Hinzufügen'}
              </button>
              {recipeEditId && (
                <button type="button" className="ghost-button" onClick={resetRecipeForm}>
                  Abbrechen
                </button>
              )}
            </div>
          </form>

          <div className="list-stack compact">
            {recipes.map((recipe) => (
              <div key={recipe.id} className="list-item-row">
                <div>
                  <strong>{recipe.name}</strong>
                  <small>
                    {recipe.portionsgroesse} Portionen · {recipe.ist_unterrezept ? 'Unterrezept' : 'Hauptrezept'}
                  </small>
                </div>
                <div className="mini-actions">
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setRecipeEditId(recipe.id);
                      setRecipeForm({
                        name: recipe.name,
                        portionsgroesse: String(recipe.portionsgroesse),
                        ist_unterrezept: recipe.ist_unterrezept,
                        verkaufspreis_netto: recipe.verkaufspreis_netto == null ? '' : String(recipe.verkaufspreis_netto),
                      });
                    }}
                  >
                    Bearbeiten
                  </button>
                  <button type="button" className="danger-button" onClick={() => handleDeleteRecipe(recipe.id)}>
                    Löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel form-panel">
          <h3>Betriebsdaten</h3>

          <div className="settings-stack">
            <form onSubmit={handleFixedCostSubmit} className="form-stack compact-form">
              <h4>Fixkosten</h4>
              <label>
                Kategorie
                <input value={fixedCostForm.kategorie} onChange={(event) => setFixedCostForm((current) => ({ ...current, kategorie: event.target.value }))} required />
              </label>
              <label>
                Betrag / Monat
                <input type="number" step="0.01" value={fixedCostForm.betrag_monat} onChange={(event) => setFixedCostForm((current) => ({ ...current, betrag_monat: event.target.value }))} required />
              </label>
              <label>
                Gültig ab
                <input type="date" value={fixedCostForm.gueltig_ab} onChange={(event) => setFixedCostForm((current) => ({ ...current, gueltig_ab: event.target.value }))} required />
              </label>
              <button type="submit" className="primary-button small-button">Speichern</button>
            </form>

            <form onSubmit={handleSalesSubmit} className="form-stack compact-form">
              <h4>Auslastung</h4>
              <label>
                Monat
                <input type="month" value={salesForm.monat} onChange={(event) => setSalesForm((current) => ({ ...current, monat: event.target.value }))} required />
              </label>
              <div className="two-col">
                <label>
                  Gäste
                  <input type="number" value={salesForm.gaeste} onChange={(event) => setSalesForm((current) => ({ ...current, gaeste: event.target.value }))} />
                </label>
                <label>
                  Verkaufte Speisen
                  <input type="number" value={salesForm.verkaufte_speisen} onChange={(event) => setSalesForm((current) => ({ ...current, verkaufte_speisen: event.target.value }))} />
                </label>
              </div>
              <label>
                Oe-Bon
                <input type="number" step="0.01" value={salesForm.oe_bon} onChange={(event) => setSalesForm((current) => ({ ...current, oe_bon: event.target.value }))} />
              </label>
              <button type="submit" className="primary-button small-button">Speichern</button>
            </form>

            <form onSubmit={handleLaborSubmit} className="form-stack compact-form">
              <h4>Personalkategorien</h4>
              <label>
                Bezeichnung
                <input value={laborForm.bezeichnung} onChange={(event) => setLaborForm((current) => ({ ...current, bezeichnung: event.target.value }))} required />
              </label>
              <label>
                Stundenlohn AG gesamt
                <input type="number" step="0.01" value={laborForm.stundensatz_ag_gesamt} onChange={(event) => setLaborForm((current) => ({ ...current, stundensatz_ag_gesamt: event.target.value }))} required />
              </label>
              <button type="submit" className="primary-button small-button">Speichern</button>
            </form>

            <form onSubmit={handleTaxSubmit} className="form-stack compact-form">
              <h4>Steuersätze</h4>
              <label>
                Bezeichnung
                <input value={taxForm.bezeichnung} onChange={(event) => setTaxForm((current) => ({ ...current, bezeichnung: event.target.value }))} required />
              </label>
              <label>
                Satz %
                <input type="number" step="0.01" value={taxForm.satz_pct} onChange={(event) => setTaxForm((current) => ({ ...current, satz_pct: event.target.value }))} required />
              </label>
              <button type="submit" className="primary-button small-button">Speichern</button>
            </form>

            <form onSubmit={handleChannelSubmit} className="form-stack compact-form">
              <h4>Verkaufskanäle</h4>
              <label>
                Name
                <input value={channelForm.name} onChange={(event) => setChannelForm((current) => ({ ...current, name: event.target.value }))} required />
              </label>
              <div className="two-col">
                <label>
                  Provision %
                  <input type="number" step="0.01" value={channelForm.provision_pct} onChange={(event) => setChannelForm((current) => ({ ...current, provision_pct: event.target.value }))} />
                </label>
                <label>
                  Kartengebühr %
                  <input type="number" step="0.01" value={channelForm.kartengebuehr_pct} onChange={(event) => setChannelForm((current) => ({ ...current, kartengebuehr_pct: event.target.value }))} />
                </label>
              </div>
              <label>
                Verpackungskosten
                <input type="number" step="0.01" value={channelForm.verpackungskosten} onChange={(event) => setChannelForm((current) => ({ ...current, verpackungskosten: event.target.value }))} />
              </label>
              <label>
                Steuersatz
                <select value={channelForm.steuersatz_id} onChange={(event) => setChannelForm((current) => ({ ...current, steuersatz_id: event.target.value }))}>
                  <option value="">Keine Auswahl</option>
                  {taxRates.map((tax) => (
                    <option key={tax.id} value={tax.id}>
                      {tax.bezeichnung}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="primary-button small-button">Speichern</button>
            </form>

            <form onSubmit={handleGoalSubmit} className="form-stack compact-form">
              <h4>Ziel</h4>
              <label>
                Typ
                <select value={goalForm.ziel_typ} onChange={(event) => setGoalForm((current) => ({ ...current, ziel_typ: event.target.value as 'db_quote' | 'gewinn_eur' }))}>
                  <option value="db_quote">DB Quote</option>
                  <option value="gewinn_eur">Gewinn in €</option>
                </select>
              </label>
              <label>
                Wert
                <input type="number" step="0.01" value={goalForm.wert} onChange={(event) => setGoalForm((current) => ({ ...current, wert: event.target.value }))} required />
              </label>
              <button type="submit" className="primary-button small-button">Speichern</button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
