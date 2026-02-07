# Copilot Assets Manager

**Gérez facilement vos fichiers de configuration GitHub Copilot** (instructions, agents, skills, prompts) depuis des dépôts Git partagés.

Cette extension permet aux équipes de développement de :
- 📦 Parcourir les assets Copilot depuis des dépôts GitHub centralisés
- ⬇️ Télécharger et synchroniser automatiquement les fichiers dans leur workspace
- 🔄 Détecter et appliquer les mises à jour disponibles
- ⚠️ Gérer les conflits locaux lors des mises à jour

## Table des matières

- [Installation](#installation)
- [Configuration](#configuration)
- [Utilisation](#utilisation)
- [Gestion des conflits](#gestion-des-conflits)
- [Authentification](#authentification)
- [Résolution des problèmes](#résolution-des-problèmes)
- [Développement](#développement)

## Installation

1. Installez l'extension depuis le marketplace VS Code ou via VSIX
2. Redémarrez VS Code
3. L'icône "Copilot Assets" apparaît dans la barre d'activité (Activity Bar)

## Configuration

### 1. Configurer les dépôts sources

Ouvrez les settings VS Code (`Ctrl+,` ou `Cmd+,`) et recherchez `Copilot Assets Manager`.

**Configuration minimale** :

```json
{
  "copilotAssetsManager.repositories": [
    {
      "owner": "votre-org",
      "repo": "copilot-instructions"
    }
  ]
}
```

**Configuration complète** :

```json
{
  "copilotAssetsManager.repositories": [
    {
      "owner": "votre-org",
      "repo": "copilot-instructions",
      "branch": "main",
      "path": "/",
      "label": "Instructions Copilot"
    },
    {
      "owner": "votre-org",
      "repo": "copilot-agents",
      "branch": "main",
      "path": "/agents",
      "label": "Agents partagés"
    }
  ]
}
```

**Paramètres disponibles** :

| Paramètre | Type | Requis | Défaut | Description |
|-----------|------|--------|--------|-------------|
| `owner` | string | ✅ | - | Organisation ou utilisateur propriétaire du dépôt |
| `repo` | string | ✅ | - | Nom du dépôt GitHub |
| `branch` | string | ❌ | `main` | Branche à suivre |
| `path` | string | ❌ | `/` | Sous-dossier à scanner (ex: `/agents`) |
| `label` | string | ❌ | `owner/repo` | Libellé affiché dans l'arborescence |

### 2. GitHub Enterprise (optionnel)

Si vous utilisez GitHub Enterprise :

```json
{
  "copilotAssetsManager.githubEnterpriseUrl": "https://github.votreentreprise.com"
}
```

Laissez vide pour utiliser github.com.

### 3. Configuration avancée

#### Extensions de fichiers

Par défaut, l'extension scanne les fichiers : `.md`, `.json`, `.yml`, `.yaml`, `.prompt`

```json
{
  "copilotAssetsManager.fileExtensions": [".md", ".json", ".prompt"]
}
```

#### Destination des fichiers

Par défaut, les fichiers sont téléchargés dans `.github/` **en préservant l'arborescence du dépôt source**.

**Exemple 1 : Fichiers à la racine du dépôt** :
- Dépôt source : `agents/cobol-reviewer.md`
- Destination locale : `.github/agents/cobol-reviewer.md`

**Exemple 2 : Fichiers déjà dans `.github/` du dépôt** :
- Dépôt source : `.github/agents/cobol-reviewer.md`
- Destination locale : `.github/agents/cobol-reviewer.md` (pas de duplication)

**Exemple 3 : Skills** (dossiers complets) :
- Dépôt source : `skills/my-skill/` ou `.github/skills/my-skill/`
- Destination locale : `.github/skills/my-skill/` (tous les fichiers et sous-dossiers copiés)

**⚠️ Note importante** : L'extension détecte automatiquement si le chemin dans le dépôt commence déjà par le répertoire de destination (`.github/`) et évite la duplication. Vous n'aurez jamais `.github/.github/`.

Pour changer le répertoire de base :

```json
{
  "copilotAssetsManager.destinationMappings": {
    "default": ".copilot"
  }
}
```

Résultat :
- Dépôt : `agents/cobol-reviewer.md` → Workspace : `.copilot/agents/cobol-reviewer.md`
- Dépôt : `.copilot/agents/file.md` → Workspace : `.copilot/agents/file.md` (détection automatique)

#### Profondeur de scan

Limite la profondeur de l'arborescence scannée (défaut: 3 niveaux) :

```json
{
  "copilotAssetsManager.maxDepth": 5
}
```

#### Vérification au démarrage

Désactivez la vérification automatique au démarrage du workspace :

```json
{
  "copilotAssetsManager.checkOnStartup": false
}
```

## Utilisation

### Interface TreeView

Cliquez sur l'icône **Copilot Assets** dans la barre d'activité pour afficher l'arborescence des assets.

**Icônes d'état** :

| Icône | État | Description |
|-------|------|-------------|
| ☁️ | Non installé | Le fichier/skill existe dans le dépôt mais pas localement |
| ✅ | À jour | La version locale correspond à la version distante |
| ⬆️ | Mise à jour disponible | Une version plus récente existe dans le dépôt |
| ⚠️ | Modifié localement | Le fichier/skill local a été modifié manuellement |

**Types d'assets** :

Dans le TreeView, vous verrez deux types d'assets :

1. **Fichiers simples** : fichiers individuels (`.md`, `.json`, etc.)
   - Affichés dans l'arborescence avec leur nom complet
   - Exemple : `copilot-instructions.md`

2. **Skills** : dossiers complets dans `skills/` contenant `SKILL.md` + autres fichiers/dossiers
   - **Affichés comme un seul nœud** avec le nom du dossier (ex: `my-cobol-skill`)
   - Indication "Skill - [état]" dans la description
   - **Les fichiers contenus ne sont pas affichés** dans le TreeView
   - Au téléchargement/mise à jour : **tout le contenu du dossier** est copié récursivement
   - Toutes les actions (Download, Update, Remove) s'appliquent sur le skill complet

**Exemple de TreeView** :

```
📦 Copilot Assets
├── 📁 Mon Dépôt
│   ├── 📄 copilot-instructions.md        ← Fichier simple
│   ├── 📁 agents
│   │   ├── 📄 cobol-reviewer.md          ← Fichier simple
│   │   └── 📄 jcl-generator.md           ← Fichier simple
│   └── 📁 skills
│       ├── 🎓 my-cobol-skill              ← Skill (dossier complet)
│       └── 🎓 db2-helper                  ← Skill (dossier complet)
```

Note : Les fichiers contenus dans `my-cobol-skill` (comme `SKILL.md`, `config.json`, etc.) ne sont **pas affichés** dans le TreeView.

### Commandes disponibles

#### Via le TreeView (clic droit)

- **Download** : Télécharger un fichier ou skill depuis le dépôt
  - Fichier : télécharge le fichier unique
  - Skill : télécharge tout le dossier récursivement
- **Download All** : Télécharger tous les assets non installés d'un dépôt
- **Update** : Mettre à jour un fichier ou skill
  - Skill : met à jour tous les fichiers du dossier
- **Show Diff** : Voir les différences entre version locale et distante
- **Open on GitHub** : Ouvrir le fichier/dossier dans GitHub (navigateur)
- **Remove Asset** : Supprimer le fichier/skill local et son entrée dans le manifeste
  - Skill : supprime tout le dossier

#### Via la palette de commandes (`Ctrl+Shift+P` ou `Cmd+Shift+P`)

- `Copilot Assets: Refresh` — Rafraîchir la liste depuis GitHub
- `Copilot Assets: Update All` — Mettre à jour tous les assets obsolètes
- `Copilot Assets: Configure Repositories` — Ouvrir les settings

### Workflow typique

#### Premier téléchargement

1. Configurez vos dépôts dans les settings
2. Ouvrez le TreeView "Copilot Assets"
3. Les fichiers et skills apparaissent avec l'icône ☁️ "Non installé"
4. Clic droit sur un fichier/skill → **Download**
   - Fichier : télécharge le fichier unique
   - Skill : télécharge tout le dossier récursivement
   - Ou clic droit sur un dépôt → **Download All**
5. Les assets sont téléchargés dans `.github/` (ou votre destination configurée) **en préservant l'arborescence**

#### Mises à jour

L'extension vérifie automatiquement les mises à jour au démarrage du workspace.

**Notification** : Si des mises à jour sont disponibles, vous recevez une notification :
```
3 Copilot assets have updates available.
[View] [Update All] [Dismiss]
```

**Status Bar** : Le nombre de mises à jour s'affiche dans la barre de statut :
```
☁️ 3 updates
```

**Mise à jour manuelle** :
1. Icône ⬆️ dans le TreeView
2. Clic droit → **Update**
3. Si le fichier n'a pas été modifié localement : mise à jour automatique
4. Si le fichier a été modifié : voir section "Gestion des conflits"

## Gestion des conflits

Lorsqu'un fichier local a été modifié ET qu'une mise à jour est disponible, l'extension détecte le conflit et vous propose :

**Dialog de conflit** :
```
"copilot-instructions.md" has been locally modified.
Overwrite with the remote version?

[Overwrite] [Keep Local] [Show Diff]
```

- **Overwrite** : Écrase la version locale avec la version distante
- **Keep Local** : Conserve vos modifications (l'asset reste marqué comme "modifié")
- **Show Diff** : Ouvre un éditeur de comparaison pour visualiser les différences

> **Note** : Le SHA distant est enregistré même si vous choisissez "Keep Local", pour ne pas vous notifier à nouveau lors du prochain sync.

### Manifeste local

L'extension crée un fichier `.copilot-assets.json` à la racine de votre workspace :

```json
{
  "version": "1.0",
  "assets": {
    ".github/agents/cobol-reviewer.md": {
      "source": {
        "owner": "votre-org",
        "repo": "copilot-agents",
        "branch": "main",
        "path": "agents/cobol-reviewer.md"
      },
      "remoteSha": "abc123def456...",
      "localContentHash": "sha256:e3b0c44298fc1c14...",
      "installedAt": "2026-02-07T10:30:00Z",
      "updatedAt": "2026-02-07T10:30:00Z"
    }
  }
}
```

**⚠️ Important** :
- Versionnez ce fichier dans Git pour que toute l'équipe partage l'état des assets
- Si vous supprimez manuellement des fichiers du workspace, l'extension détectera automatiquement qu'ils ne sont plus installés et les affichera avec l'icône ☁️ dans le TreeView

## Authentification

L'extension utilise le mécanisme d'authentification VS Code :

1. Au premier accès à un dépôt, VS Code demande de vous authentifier
2. Choisissez le provider approprié :
   - **GitHub** pour github.com
   - **GitHub Enterprise** si vous avez configuré une URL GHE
3. Suivez le flow OAuth dans votre navigateur
4. Le token est stocké de manière sécurisée par VS Code

**Permissions requises** : `repo` (lecture des dépôts privés/publics)

## Résolution des problèmes

### "No repositories configured"

➡️ Configurez au moins un dépôt dans les settings : `copilotAssetsManager.repositories`

### "Open a workspace to manage assets"

➡️ L'extension nécessite un workspace ouvert. Ouvrez un dossier avec VS Code.

### Erreur d'authentification

➡️ Cliquez sur le message d'erreur → **Sign In** pour réauthentifier

### "Repository or path not found" (404)

➡️ Vérifiez :
- Le nom du dépôt est correct (`owner/repo`)
- Vous avez les permissions de lecture sur ce dépôt
- Le `path` configuré existe dans le dépôt
- La `branch` spécifiée existe

### "GitHub API rate limit exceeded"

➡️ GitHub limite le nombre de requêtes API par heure :
- **Non authentifié** : 60 requêtes/heure
- **Authentifié** : 5000 requêtes/heure
- **GitHub Enterprise** : Limites généralement plus élevées

Attendez la fin de la fenêtre (affichée dans le message d'erreur) ou authentifiez-vous si ce n'est pas déjà fait.

### Les fichiers ne se mettent pas à jour

1. Clic sur le bouton **Refresh** dans le TreeView
2. Vérifiez que le manifeste `.copilot-assets.json` n'est pas corrompu
3. En dernier recours : supprimez `.copilot-assets.json` et retéléchargez

### Fichiers supprimés manuellement

Si vous supprimez manuellement des fichiers du dossier `.github/` :
- L'extension détecte automatiquement leur absence
- Ils apparaissent comme "Non installé" (☁️) dans le TreeView
- Vous pouvez les retélécharger avec la commande **Download**
- Le manifeste `.copilot-assets.json` conserve leur entrée jusqu'au prochain **Download** ou **Remove**

## Structure du projet workspace

Après téléchargement, votre workspace ressemble à :

```
mon-projet/
├── .github/                      ← Fichiers Copilot téléchargés
│   ├── copilot-instructions.md   ← Fichier simple à la racine
│   ├── agents/                   ← Dossier agents/ du dépôt source
│   │   ├── cobol-reviewer.md
│   │   └── jcl-generator.md
│   ├── prompts/                  ← Dossier prompts/ du dépôt source
│   │   └── db2-prompt.md
│   └── skills/                   ← Dossier skills/ avec skills complets
│       └── my-skill/             ← Skill = dossier complet
│           ├── SKILL.md         ← Fichier principal du skill
│           ├── config.json
│           └── helpers/          ← Sous-dossiers préservés
│               └── utils.ts
├── .copilot-assets.json         ← Manifeste (à versionner)
├── src/
└── ...
```

**L'arborescence du dépôt source est entièrement préservée** sous le répertoire de base (`.github/` par défaut).

**Skills** : Les dossiers dans `skills/` contenant un fichier `SKILL.md` sont reconnus comme des skills et téléchargés intégralement avec tous leurs fichiers et sous-dossiers.

## Scénarios d'équipe

### Nouveau membre

1. Clone le projet
2. Ouvre VS Code
3. L'extension détecte le manifeste `.copilot-assets.json`
4. Notification : "X assets are not installed"
5. Clic **Download All** → tous les assets sont téléchargés automatiquement avec leur structure

### Mise à jour par l'équipe ops

1. L'équipe ops pousse de nouvelles instructions dans `copilot-instructions` repo
2. Au prochain démarrage, chaque développeur reçoit une notification de mise à jour
3. Clic **Update All** → tout le monde utilise la dernière version

### Personnalisation locale temporaire

1. Développeur modifie localement `copilot-instructions.md` pour un test
2. L'icône passe à ⚠️ "Modifié localement"
3. Une mise à jour arrive → dialog de conflit
4. Choix **Show Diff** pour voir les changements, puis **Overwrite** ou **Keep Local**

## Développement

### Build depuis les sources

```bash
cd copilot-assets-manager
npm install
npm run compile
```

### Tests

```bash
npm test              # Exécute les tests unitaires (Vitest)
npm run test:watch    # Mode watch
npm run check-types   # Vérification TypeScript
```

Tous les tests sont dans `src/**/*.test.ts` avec 57 tests couvrant :
- Normalisation de configuration
- Calcul de hash SHA-256
- Pattern matching et destination
- Gestion du manifeste
- États des assets
- Synchronisation avec erreurs
- Requêtes GitHub API

### Packaging

```bash
npm run package       # Crée un fichier .vsix
```

### Architecture

```
src/
├── extension.ts              # Point d'entrée
├── config/
│   └── settings.ts          # Lecture des settings VS Code
├── github/
│   ├── types.ts             # Types API GitHub
│   ├── auth.ts              # Authentification
│   └── client.ts            # Client REST API
├── models/
│   ├── asset.ts             # Modèle Asset
│   ├── repository.ts        # Modèle Repository
│   └── manifest.ts          # Gestionnaire manifeste
├── services/
│   ├── assetService.ts      # Logique métier
│   ├── hashService.ts       # Calcul SHA-256
│   └── syncService.ts       # Orchestration sync
├── views/
│   ├── treeItems.ts         # TreeItem avec icônes
│   ├── assetsTreeProvider.ts # TreeDataProvider
│   └── statusBar.ts         # Status bar item
└── utils/
    ├── fileUtils.ts         # Opérations fichiers
    └── patternMatcher.ts    # Destination mapping
```

## Limitations connues

- **Multi-root workspaces** : Seul le premier workspace folder est utilisé comme destination
- **Gros dépôts** : Le scan utilise l'API `git/trees` (1 appel par repo) mais peut être lent sur des dépôts très volumineux
- **Fichiers binaires** : Non supportés (seuls les fichiers texte base64-encodés)

## Contribuer

Les contributions sont les bienvenues ! Ce projet suit les spécifications définies dans `copilot-assets-manager-spec.md`.

## Licence

À définir

## Support

Pour rapporter un bug ou proposer une fonctionnalité, ouvrez une issue sur le dépôt GitHub du projet.
