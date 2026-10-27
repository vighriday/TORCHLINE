import { expect, test } from '@playwright/test';
import { database } from '../helpers.ts';
import { authorize, liveConfig, providerFixture } from '../twitch-provider.ts';
import { createApp } from '../../apps/server/src/app.ts';

test('operator bot setup confirms the named account and converts an accidental creator without a disconnect loop', async ({
  page,
  context,
}) =>
  database(async (store) => {
    const baseUrl = 'http://localhost:3101';
    const config = { ...liveConfig, baseUrl };
    const provider = providerFixture(config);
    const fetcher: typeof provider.fetcher = async (input, init) => {
      const response = await provider.fetcher(input, init);
      if (String(input).endsWith('/validate')) {
        const identity = await response.json();
        return Response.json({ ...identity, scopes: [...identity.scopes, 'channel:bot'] });
      }
      return response;
    };
    const app = await createApp(store, config, { fetcher });
    provider.attach(app);
    try {
      await app.listen({ port: 3101, host: '127.0.0.1' });
      const creator = await authorize(app, '99');
      const token = creator.headers.cookie.slice('torchline_session='.length);
      await context.addCookies([
        { name: 'torchline_session', value: token, url: baseUrl, httpOnly: true, sameSite: 'Lax' },
      ]);
      await page.goto(baseUrl);
      let authorization: URL | undefined;
      await page.route('https://id.twitch.tv/oauth2/authorize**', async (route) => {
        authorization = new URL(route.request().url());
        await route.fulfill({
          contentType: 'text/plain',
          body: 'Fixture Twitch consent; no real provider request.',
        });
      });
      await expect(page.getByText('Twitch creator session', { exact: true })).toBeVisible();
      await page
        .getByRole('navigation', { name: 'Command deck' })
        .getByRole('button', { name: /Broadcast/ })
        .click();
      const setup = page.getByLabel('Bot setup secret', { exact: true });
      await expect(setup).toBeVisible();
      await setup.fill('wrong-fixture-key');
      await page.getByRole('button', { name: 'Authorize the dedicated bot', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Operator authorization required');
      await setup.fill(config.botSetupSecret);
      await page.getByRole('button', { name: 'Authorize the dedicated bot', exact: true }).click();
      await expect(page).toHaveURL(/id\.twitch\.tv\/oauth2\/authorize/);
      await page.goto(
        `${baseUrl}/auth/twitch/callback?code=99&state=${authorization!.searchParams.get('state')}`,
      );
      await expect(
        page.getByRole('heading', { name: 'Use fixture_99 as the dedicated bot?' }),
      ).toBeVisible();
      expect((await store.creator('99'))?.connected).toBe(true);
      await page.route('**/api/state', async (route) => {
        const response = await route.fetch();
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.fulfill({ response });
      });
      await page
        .getByRole('button', { name: 'Convert fixture_99 to the dedicated bot', exact: true })
        .click();
      await expect(
        page.getByText(
          'Dedicated bot authorization is current. Connect the broadcaster to finish channel setup.',
          { exact: true },
        ),
      ).toBeVisible();
      await expect(page.getByRole('alert')).not.toBeVisible();
      expect(
        (await store.pool.query("SELECT 1 FROM oauth_grants WHERE id='99' AND role='bot'"))
          .rowCount,
      ).toBe(1);
      expect((await store.creator('99'))?.connected).toBe(false);
    } finally {
      await page.goto('about:blank');
      await app.close();
    }
  }));
