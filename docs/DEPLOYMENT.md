# Deployment

## Local Convex

Use the Convex client deployment URL for the React app:

```sh
CONVEX_DEPLOYMENT=dev:quirky-ermine-890
NEXT_PUBLIC_CONVEX_URL=https://quirky-ermine-890.convex.cloud
```

`https://quirky-ermine-890.convex.cloud` is the value for `NEXT_PUBLIC_CONVEX_URL`. The `.site` URL is for Convex HTTP routes/actions and is not needed by the current React client.

If the project has not been linked on your machine yet, run this in an interactive terminal:

```sh
npx convex dev --once --configure existing --dev-deployment cloud
```

The CLI will ask for the team and project. After linking, `npx convex codegen` regenerates `convex/_generated/` and uploads functions to the configured dev deployment.

## Vercel

Set these environment variables in the Vercel project:

```sh
NEXT_PUBLIC_CONVEX_URL=https://quirky-ermine-890.convex.cloud
CONVEX_DEPLOY_KEY=<production deploy key>
```

Create `CONVEX_DEPLOY_KEY` from the Convex dashboard production deployment settings. It should include permission to deploy functions.

Set the Vercel build command to:

```sh
npx convex deploy --cmd 'npm run build'
```

The default install command can stay as Vercel's npm default unless the project later switches package managers.

## Seeding Content

After Convex is linked and env vars are set, seed the broad PokeAPI snapshot with:

```sh
npm run seed:content
```

For quick local testing, the home screen also includes a starter seed button that calls the small curated seed mutation.
