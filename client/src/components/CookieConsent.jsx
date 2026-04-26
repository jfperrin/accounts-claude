import { useEffect } from 'react';
import * as CookieConsent from 'vanilla-cookieconsent';
import 'vanilla-cookieconsent/dist/cookieconsent.css';

export default function CookieConsentBanner() {
  useEffect(() => {
    CookieConsent.run({
      // Révision : incrémentez ce numéro pour forcer une nouvelle demande de consentement
      revision: 1,

      // Catégories de cookies
      categories: {
        necessary: {
          enabled: true,   // toujours actif
          readOnly: true,  // l'utilisateur ne peut pas le désactiver
        },
        // Prêt pour une future intégration analytics
        // analytics: {
        //   autoClear: { cookies: [{ name: /^_ga/ }] },
        // },
      },

      // Interface et traductions
      language: {
        default: 'fr',
        translations: {
          fr: {
            consentModal: {
              title: 'Nous utilisons des cookies',
              description:
                'Cette application utilise des cookies strictement nécessaires à son fonctionnement (authentification, session). '
                + 'Aucun cookie de traçage ou publicitaire n\'est déposé. '
                + '<a href="/cgu" class="cc__link" target="_blank">Conditions Générales d\'Utilisation</a>',
              acceptAllBtn: 'Accepter',
              acceptNecessaryBtn: 'Refuser les optionnels',
              showPreferencesBtn: 'Gérer les préférences',
              footer: '© ' + new Date().getFullYear() + ' Gestion de Comptes',
            },
            preferencesModal: {
              title: 'Préférences des cookies',
              acceptAllBtn: 'Tout accepter',
              acceptNecessaryBtn: 'Tout refuser',
              savePreferencesBtn: 'Enregistrer mes choix',
              closeIconLabel: 'Fermer',
              serviceCounterLabel: 'Service|Services',
              sections: [
                {
                  title: 'Utilisation des cookies',
                  description:
                    'Nous utilisons des cookies pour assurer le bon fonctionnement de l\'application. '
                    + 'Les cookies strictement nécessaires ne peuvent pas être désactivés car l\'application '
                    + 'ne peut pas fonctionner sans eux. '
                    + 'Consultez nos <a href="/cgu" class="cc__link" target="_blank">CGU</a> pour en savoir plus.',
                },
                {
                  title: 'Cookies strictement nécessaires',
                  description:
                    'Ces cookies sont indispensables au fonctionnement de l\'application. '
                    + 'Ils permettent de maintenir votre session authentifiée et de sécuriser votre compte. '
                    + 'Sans ces cookies, vous ne pourriez pas vous connecter.',
                  linkedCategory: 'necessary',
                  cookieTable: {
                    headers: {
                      name: 'Cookie',
                      domain: 'Domaine',
                      desc: 'Description',
                      duration: 'Durée',
                    },
                    body: [
                      {
                        name: 'connect.sid',
                        domain: window.location.hostname,
                        desc: 'Cookie de session — maintient votre connexion active',
                        duration: 'Session (jusqu\'à fermeture du navigateur ou déconnexion)',
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },

      // Personnalisation visuelle (couleurs accordées au thème indigo/violet de l'app)
      guiOptions: {
        consentModal: {
          layout: 'box',
          position: 'bottom right',
          equalWeightButtons: false,
          flipButtons: false,
        },
        preferencesModal: {
          layout: 'box',
          equalWeightButtons: true,
          flipButtons: false,
        },
      },
    });
  }, []);

  return null;
}
