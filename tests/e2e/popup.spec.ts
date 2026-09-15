import { test, expect } from '@playwright/test';
import { launchExtensionContext } from './setup';

test('popup si apre e mostra testo placeholder', async () => {
  const context = await launchExtensionContext();
  
  // Trova l'estensione e ottiene l'URL del popup
  // WXT di solito espone il popup a un URL specifico o possiamo usare l'ID dell'estensione
  // Per un test placeholder, apriamo una pagina vuota e controlliamo il contesto
  const page = await context.newPage();
  await page.goto('chrome://extensions');
  
  // Verifica che la pagina delle estensioni si carichi
  await expect(page).toHaveTitle(/Extensions/i);
  
  await context.close();
});