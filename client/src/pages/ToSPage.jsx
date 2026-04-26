import { Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Footer from '@/components/layout/Footer';

export default function ToSPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
    <div className="flex-1 py-12 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Gestion de Comptes</h1>
        </div>

        <div className="rounded-2xl bg-white p-10 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-2 text-3xl font-extrabold tracking-tight text-slate-900">
            Conditions Générales d'Utilisation
          </h2>
          <p className="mb-8 text-sm text-slate-500">Dernière mise à jour : 26 avril 2026</p>

          <Section title="1. Objet">
            <p>
              Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation
              de l'application « Gestion de Comptes » (ci-après « l'Application »), logiciel de suivi
              budgétaire personnel mis à disposition par son auteur (ci-après « l'Éditeur »).
            </p>
            <p className="mt-3">
              En créant un compte, l'utilisateur reconnaît avoir lu, compris et accepté sans réserve
              l'intégralité des présentes CGU.
            </p>
          </Section>

          <Section title="2. Accès au service">
            <p>
              L'Application est accessible après inscription et vérification de l'adresse email.
              L'Éditeur se réserve le droit de suspendre ou résilier tout compte en cas de manquement
              aux présentes CGU, sans préavis ni indemnité.
            </p>
            <p className="mt-3">
              L'utilisateur est seul responsable de la confidentialité de ses identifiants de connexion.
              Toute utilisation du compte avec les identifiants de l'utilisateur est réputée effectuée
              par ce dernier.
            </p>
          </Section>

          <Section title="3. Responsabilité concernant les données">
            <Disclaimer>
              L'Application est un outil d'aide à la gestion budgétaire personnelle. Les données
              saisies ou importées (opérations bancaires, soldes, catégories, récurrences) sont
              stockées dans la limite des capacités techniques du service.
            </Disclaimer>
            <p className="mt-4">
              <strong>L'Éditeur ne saurait être tenu responsable :</strong>
            </p>
            <ul className="mt-2 list-disc pl-6 space-y-2 text-slate-700">
              <li>
                de toute <strong>perte, corruption ou destruction de données</strong>, quelle qu'en
                soit la cause (panne matérielle, erreur logicielle, attaque informatique, force majeure
                ou toute autre cause) ;
              </li>
              <li>
                du <strong>caractère inexact, incomplet ou non à jour</strong> des informations
                affichées dans l'Application, notamment en ce qui concerne les soldes et projections
                financières ;
              </li>
              <li>
                des <strong>conséquences de toute décision financière</strong> prise sur la base des
                données et projections affichées dans l'Application.
              </li>
            </ul>
            <p className="mt-4">
              Il incombe à l'utilisateur de maintenir ses propres sauvegardes de données et de
              vérifier régulièrement l'exactitude des informations saisies en les comparant à ses
              relevés bancaires officiels.
            </p>
          </Section>

          <Section title="4. Limitation de responsabilité — dysfonctionnements">
            <Disclaimer>
              L'Application est fournie « en l'état » (as-is), sans garantie d'aucune sorte,
              expresse ou implicite, y compris sans garantie de disponibilité, d'exactitude, de
              fiabilité, d'adéquation à un usage particulier ou d'absence de bugs.
            </Disclaimer>
            <p className="mt-4">
              L'Éditeur ne garantit pas que le service sera ininterrompu, exempt d'erreurs ou
              disponible à tout moment. Des interruptions de service peuvent survenir à tout moment
              pour des raisons de maintenance, de mise à jour ou de défaillance technique.
            </p>
            <p className="mt-3">
              En aucun cas l'Éditeur ne pourra être tenu responsable de dommages directs, indirects,
              accessoires, spéciaux ou consécutifs résultant de l'utilisation ou de l'impossibilité
              d'utiliser l'Application, y compris en cas de bugs, erreurs d'affichage, calculs
              incorrects ou indisponibilité du service.
            </p>
          </Section>

          <Section title="5. Exonération générale de responsabilité">
            <Disclaimer>
              Dans toute la mesure permise par la loi applicable, l'Éditeur exclut toute
              responsabilité de quelque nature que ce soit (contractuelle, délictuelle ou autre)
              pour tout dommage résultant directement ou indirectement de l'utilisation ou de
              l'impossibilité d'utiliser l'Application.
            </Disclaimer>
            <p className="mt-4">
              L'utilisateur reconnaît utiliser l'Application sous sa seule responsabilité et à ses
              propres risques. L'Application ne constitue en aucun cas un conseil financier, fiscal,
              juridique ou comptable. Pour tout besoin en ce sens, l'utilisateur est invité à
              consulter un professionnel qualifié.
            </p>
          </Section>

          <Section title="6. Données personnelles">
            <p>
              Les données personnelles collectées (adresse email, données financières saisies par
              l'utilisateur) sont utilisées exclusivement pour le fonctionnement du service et ne sont
              pas transmises à des tiers à des fins commerciales.
            </p>
            <p className="mt-3">
              Conformément à la réglementation applicable (RGPD), l'utilisateur dispose d'un droit
              d'accès, de rectification et de suppression de ses données en contactant l'Éditeur.
              La suppression du compte entraîne la suppression de toutes les données associées.
            </p>
          </Section>

          <Section title="7. Modification des CGU">
            <p>
              L'Éditeur se réserve le droit de modifier les présentes CGU à tout moment. Les
              modifications entrent en vigueur dès leur publication dans l'Application. La poursuite
              de l'utilisation du service après modification vaut acceptation des nouvelles CGU.
            </p>
          </Section>

          <Section title="8. Droit applicable">
            <p>
              Les présentes CGU sont soumises au droit français. En cas de litige, et à défaut de
              résolution amiable, les tribunaux français seront seuls compétents.
            </p>
          </Section>

          <div className="mt-10 border-t border-slate-100 pt-6 text-center">
            <Link to="/login">
              <Button variant="outline">Retour à la connexion</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
    <Footer />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h3 className="mb-3 text-lg font-bold text-slate-900">{title}</h3>
      <div className="text-slate-700 leading-relaxed">{children}</div>
    </section>
  );
}

function Disclaimer({ children }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <strong className="block mb-1">⚠ Clause importante</strong>
      {children}
    </div>
  );
}
