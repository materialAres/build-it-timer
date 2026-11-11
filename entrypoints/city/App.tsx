import { useEffect } from 'react';
import { i18n } from '#i18n';
import { CityPanel } from '@/components/city/CityPanel';
import { CityEmptyHint } from '@/components/city/CityEmptyHint';

/**
 * The full-city page (CR6.T11): the same city as the popup's City tab on a big
 * canvas with a free camera. Read-only: it reads the persisted state through
 * the same selectors and updates live as the background writes (§1.3).
 */
function App() {
  useEffect(() => {
    document.title = i18n.t('cityPage.title');
  }, []);

  return (
    <main className="city-page">
      <header className="city-page__header">
        <h1 className="city-page__title">{i18n.t('cityPage.title')}</h1>
        <p className="city-page__hint">{i18n.t('cityPage.hint')}</p>
      </header>
      <CityPanel full />
      <CityEmptyHint />
    </main>
  );
}

export default App;
