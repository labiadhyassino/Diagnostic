# Mind’s Up Diagnostic

Prototype Next.js pour un diagnostic élève moderne.

## Objectif
- Migrer le diagnostic existant vers une application `Next.js`
- Utiliser `Supabase` pour la base de données en ligne
- Déployer sur `Vercel` avec une interface lisible et intuitive

## Installation

1. Installe les dépendances:

```bash
npm install
```

2. Lance le projet en local:

```bash
npm run dev
```

3. Ouvre `http://localhost:3000`

## Configuration Supabase

Crée un projet Supabase et ajoute dans un fichier `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Déploiement

- Héberge le frontend sur `Vercel`
- Utilise `Supabase` pour la base de données et les APIs

## Structure

- `app/page.tsx` : interface de démarrage et quiz
- `app/globals.css` : styles globaux inspirés de la version HTML
- `app/api/diagnostic/route.ts` : endpoint serveur pour recevoir les diagnostics
- `lib/supabaseClient.ts` : client Supabase
