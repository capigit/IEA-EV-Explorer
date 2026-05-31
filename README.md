# IEA Global EV Explorer

Application interactive 100% statique pour explorer les données mondiales sur les véhicules électriques — **IEA Global EV Outlook 2024**.

## Fonctionnalités

9 pages d'analyse :

| Page | Description |
|---|---|
| **Vue d'ensemble** | KPIs mondiaux 2023 avec delta YoY, carte choroplèthe, top pays |
| **Insights clés** | Champions de pénétration, croissances record, ratios calculés automatiquement |
| **Profil pays** | KPIs, tendances, mix BEV/PHEV/FCEV |
| **A vs B** | Comparaison côte à côte : séries et indicateurs 2023 |
| **Tendances temporelles** | Séries historiques par indicateur et mode de transport |
| **Comparaison pays** | Classement top 20 par année |
| **Carte thermique** | Matrice pays × années avec mode brut ou base 100 |
| **Infrastructure de recharge** | Bornes rapides/lentes, ratio bornes/1 000 VE |
| **Projections 2025-2035** | Scénarios APS vs STEPS avec tableau d'écarts |

## Données

**Source** : [IEA Global EV Outlook 2024](https://www.iea.org/data-and-statistics/data-product/global-ev-outlook-2024)

- 54 régions et pays
- 2010–2035 (historique + projections)
- Indicateurs : stock, ventes, parts de marché, bornes de recharge, demande électrique, déplacement pétrolier
- Types de véhicules : voitures, bus, camions, vans
- Motorisations : BEV, PHEV, FCEV

## Installation locale

```bash
git clone https://github.com/capigit/IEA-EV-Explorer.git
cd IEA-EV-Explorer

python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.

## Déploiement sur GitHub Pages

L'app tourne entièrement dans le navigateur avec HTML, CSS et JavaScript. Aucun serveur applicatif, runtime Python, Streamlit ou étape de build n'est requis.

Le déploiement est automatique à chaque push sur `main` via GitHub Actions.

**Activation (une seule fois) :**

1. Aller dans **Settings → Pages** du dépôt
2. Source : choisir **GitHub Actions**
3. Pusher sur `main` — l'URL `https://<user>.github.io/<repo>/` sera active en ~2 min

## Structure du projet

```
IEA-EV-Explorer/
├── .github/
│   └── workflows/
│       └── deploy.yml       # GitHub Actions — build + deploy GitHub Pages
├── data/
│   └── IEAGlobalEVData2024.csv
├── app.js                   # Logique, calculs et graphiques Plotly
├── index.html               # Structure de l'application
└── styles.css               # Interface responsive
```

## Stack technique

- HTML5
- CSS3
- JavaScript
- [Plotly.js](https://plotly.com/javascript/) — visualisations interactives
- [PapaParse](https://www.papaparse.com/) — lecture du CSV côté navigateur
