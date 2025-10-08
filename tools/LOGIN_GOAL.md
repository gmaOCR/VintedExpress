Objectif de capture de connexion (flow strict13. Attendre la réponse réseau du POST de connexion et la sauvegarder 14. Sauvegarder cookies + localStorage + sessionStorage 15. Naviguer vers /items/new dans la même session et sauvegarder HTML + capture d'écran

## Instructions d'utilisation

**Exécution normale :**

```bash
node tools/capture-auth-response.mjs
```

**En cas de captcha :**
Le script affichera :

```
⚠️  CAPTCHA DÉTECTÉ!
   Résolvez manuellement le captcha dans le navigateur ouvert.
   Le script reprendra automatiquement une fois résolu...
```

Actions à effectuer :

1. Résolvez le captcha dans la fenêtre du navigateur (cliquez, sélectionnez images, etc.)
2. Attendez que le script détecte la résolution (vérifie toutes les secondes)
3. Le script continue automatiquement après résolution

**Timeout :** Le script attend jusqu'à 2 minutes. Si le captcha n'est pas résolu, il s'arrête avec un code d'erreur.

Critères de succès :t : obtenir une session authentifiée reproductible et vérifier /items/new

## Améliorations anti-détection (mise à jour)

Le script utilise maintenant plusieurs techniques pour simuler un comportement humain légitime et éviter le déclenchement de captchas :

**Propriétés du navigateur :**

- User-Agent réaliste (Chrome 120 sur Windows)
- Locale et timezone français (Europe/Paris)
- Géolocalisation Paris
- Headers HTTP complets et cohérents
- Masquage des indicateurs d'automation (navigator.webdriver, plugins, etc.)
- Propriété chrome.runtime définie

**Comportement humain simulé :**

- Mouvements de souris aléatoires entre les actions
- Frappe caractère par caractère avec délais variables (50-200ms)
- Mouvements de souris occasionnels pendant la frappe
- Délai pré-soumission aléatoire (3-6s) pour laisser les challenges se résoudre

**Gestion des captchas :**
Si un captcha apparaît malgré ces mesures (recaptcha/hcaptcha/datadome), le script :

1. Le détecte automatiquement
2. Affiche un message clair à l'utilisateur
3. Attend la résolution manuelle (jusqu'à 2 minutes)
4. Reprend automatiquement une fois résolu

Étapes exactes à automatiser (FR) :

1. Naviguer vers https://www.vinted.fr/member/signup/select_type?ref_url=%2F
2. Attendre 3 secondes + mouvement souris aléatoire
3. Cliquer sur le bouton cookie `#onetrust-accept-btn-handler` ("Accepter tout")
4. Attendre 2 secondes + mouvement souris aléatoire
5. Cliquer l'élément exact suivant (bouton "Se connecter") :
   <span role="button" class="u-cursor-pointer" tabindex="0" data-testid="auth-select-type--register-switch"><span class="web_ui__Text__text web_ui__Text__body web_ui__Text__left web_ui__Text__primary web_ui__Text__underline">Se connecter </span></span>
6. Attendre 2 secondes
7. Cliquer l'élément exact suivant (option de connexion par e-mail) :
   <span role="button" class="u-cursor-pointer" tabindex="0" data-testid="auth-select-type--login-email"><span class="web_ui__Text__text web_ui__Text__body web_ui__Text__left web_ui__Text__primary web_ui__Text__underline">e-mail</span></span>
8. Attendre 2 secondes
9. Remplir le formulaire (`#username`, `#password`) : simuler une frappe humaine caractère par caractère avec un délai aléatoire entre chaque touche (par exemple 50–200 ms) au lieu d'un remplissage instantané, pour réduire les déclencheurs anti-bot.
10. Après la saisie, marquer un délai d'attente avant d'appuyer sur le bouton « Continuer » (par exemple 3–6 secondes aléatoires) afin de laisser le challenge anti-bot / Datadome se résoudre si nécessaire. Optionnel : détecter la présence de cookies comme `datadome` / `cf_clearance` ou d'une indication DOM que le challenge est passé avant de soumettre.
11. Soumettre le bouton « Continuer »
12. **Détecter présence de captcha** - Si captcha détecté, attendre résolution manuelle
13. Attendre la réponse réseau du POST de connexion et la sauvegarder
14. Sauvegarder cookies + localStorage + sessionStorage
15. Naviguer vers /items/new dans la même session et sauvegarder HTML + capture d'écran

Critères de succès :

- `tools/session.json` contient cookies
- `tools/storage.json` contient localStorage + sessionStorage
- `tools/login-response.json` contient la réponse réseau capturée du POST de connexion
- `tools/last-capture-items-new.html` montre la page `/items/new` authentifiée

Notes :

- Variables d'environnement requises : `VINTED_USER`, `VINTED_PASS`
- Playwright doit être installé et disponible
