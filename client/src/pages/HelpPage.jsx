import { HelpCircle } from 'lucide-react';

const SECTIONS = [
  { id: 'overview', title: "Vue d'ensemble" },
  { id: 'banks', title: 'Banques et solde projeté' },
  { id: 'operations', title: 'Opérations et pointage' },
  { id: 'recurring', title: 'Opérations récurrentes' },
  { id: 'categories', title: 'Catégories et budget' },
  { id: 'import', title: 'Import de relevés' },
  { id: 'period', title: 'Sélecteur de période' },
  { id: 'insights', title: 'Analyse du mois' },
  { id: 'pwa', title: 'Installation et mises à jour' },
];

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-indigo-600" />
        <h1 className="text-xl font-extrabold text-foreground">Aide</h1>
      </div>
      <p className="text-sm text-muted-foreground max-w-2xl">
        Cette page documente les notions clés de l'application : modèle de données,
        flux d'utilisation et particularités à connaître pour suivre vos comptes
        sans surprise.
      </p>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <Toc />
        <div className="space-y-8 min-w-0">
          <Overview />
          <Banks />
          <Operations />
          <Recurring />
          <Categories />
          <Import />
          <Period />
          <Insights />
          <Pwa />
        </div>
      </div>
    </div>
  );
}

function Toc() {
  return (
    <nav className="hidden lg:block sticky top-4 self-start">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Sommaire
      </p>
      <ul className="space-y-1">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="block rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {s.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-xl border border-border bg-card p-5 shadow-xs">
      <h2 className="mb-3 text-lg font-bold text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
        {children}
      </div>
    </section>
  );
}

function Overview() {
  return (
    <Section id="overview" title="Vue d'ensemble">
      <p>
        L'application centralise le suivi de plusieurs comptes bancaires.
        Quatre entités structurent le domaine&nbsp;:
      </p>
      <ul className="ml-5 list-disc space-y-1">
        <li><strong>Banques</strong>&nbsp;— un compte bancaire avec un solde courant à saisir.</li>
        <li><strong>Opérations</strong>&nbsp;— une transaction datée, débit ou crédit, rattachée à une banque.</li>
        <li><strong>Récurrentes</strong>&nbsp;— un modèle d'opération qui se reproduit chaque mois à un jour donné.</li>
        <li><strong>Catégories</strong>&nbsp;— le classement transversal des opérations, support du budget.</li>
      </ul>
      <p>
        Toutes les données sont rattachées à votre utilisateur et restent privées.
        L'authentification s'effectue par email / mot de passe ou via Google.
      </p>
    </Section>
  );
}

function Banks() {
  return (
    <Section id="banks" title="Banques et solde projeté">
      <p>
        Chaque banque expose deux soldes&nbsp;:
      </p>
      <ul className="ml-5 list-disc space-y-1">
        <li>
          <strong>Solde courant</strong>&nbsp;— la valeur que vous saisissez
          d'après le site de votre banque. Il sert de référence et n'est jamais
          modifié automatiquement.
        </li>
        <li>
          <strong>Solde projeté</strong>&nbsp;— calculé en additionnant au solde
          courant les opérations <em>non pointées</em> (passées comme futures).
          Il représente l'état de votre compte une fois toutes les opérations
          en cours réellement passées en banque.
        </li>
      </ul>
      <p className="text-muted-foreground">
        Formule&nbsp;: <code>projetté = courant + Σ montant des opérations non pointées</code>.
      </p>
      <p>
        L'accueil affiche en haut une carte <em>Soldes</em> globale,
        indépendante de la période sélectionnée&nbsp;: somme des soldes
        courants, somme des soldes projetés et total signé des opérations
        restant à pointer.
      </p>
    </Section>
  );
}

function Operations() {
  return (
    <Section id="operations" title="Opérations et pointage">
      <p>
        Une opération porte un libellé, un montant signé (négatif&nbsp;= débit,
        positif&nbsp;= crédit), une date, une banque et, en option, une
        catégorie. Le statut <strong>pointé</strong> indique qu'elle a bien été
        constatée sur le relevé bancaire.
      </p>
      <p>
        Le pointage est l'opération centrale de réconciliation&nbsp;: tant qu'une
        ligne n'est pas pointée, elle est considérée comme «&nbsp;en cours&nbsp;»
        et entre dans le calcul du solde projeté. Une fois pointée, elle ne
        modifie plus que l'historique.
      </p>
      <p>
        Lorsque vous attribuez une catégorie à une opération, l'application
        propose d'appliquer la même catégorie aux opérations similaires de
        la même banque, dans une fenêtre de ±3 mois autour de la date de
        l'opération source. Si la source était <strong>sans catégorie</strong>,
        seules les autres opérations sans catégorie sont proposées. Si la
        source <strong>changeait déjà de catégorie</strong>, les similaires
        encore dans une autre catégorie (notamment l'ancienne) sont aussi
        proposées pour les consolider sous la nouvelle. Les libellés sont
        comparés via une similarité tolérante aux variations de date /
        numéro de carte, mais suffisamment stricte pour ne pas mélanger
        deux marchands différents.
      </p>
      <p>
        <strong>Recherche et tri</strong>&nbsp;— un champ de recherche au-dessus
        du tableau filtre les opérations par libellé en temps réel (insensible
        à la casse). Sur ordinateur, les en-têtes <em>Date</em>,
        <em> Libellé</em> et <em>Montant</em> sont cliquables pour basculer
        l'ordre croissant/décroissant&nbsp;; sur mobile, un sélecteur dédié
        offre les mêmes options de tri.
      </p>
    </Section>
  );
}

function Recurring() {
  return (
    <Section id="recurring" title="Opérations récurrentes">
      <p>
        Une récurrente décrit un modèle&nbsp;: libellé, montant, jour du mois,
        banque, catégorie. Elle ne crée pas d'opération tant que vous ne le
        demandez pas.
      </p>
      <p>
        Depuis la page Opérations, l'action <em>Générer les récurrentes</em>
        crée pour le mois choisi les opérations correspondant à chaque
        récurrente, prêtes à être pointées dès qu'elles apparaissent sur le
        relevé. Le montant prévu peut être ajusté ensuite&nbsp;: à l'import
        d'un relevé, l'opération réelle écrase le montant estimé.
      </p>
      <p>
        Les récurrentes alimentent aussi&nbsp;:
      </p>
      <ul className="ml-5 list-disc space-y-1">
        <li>la part «&nbsp;Récurrentes&nbsp;» du budget mensuel d'une catégorie&nbsp;;</li>
        <li>les suggestions automatiques détectées dans l'historique.</li>
      </ul>
      <p>
        Le tableau se trie en cliquant sur les en-têtes&nbsp;: <em>Libellé</em>,
        <em> Banque</em>, <em>Catégorie</em>, <em>Jour</em> et <em>Montant</em>.
        Chaque clic bascule l'ordre croissant / décroissant.
      </p>
    </Section>
  );
}

function Categories() {
  return (
    <Section id="categories" title="Catégories et budget">
      <p>
        Une catégorie a un <strong>type</strong> (dépense ou revenu), une
        couleur, et un <strong>complément mensuel</strong> facultatif. Le
        budget mensuel s'obtient en additionnant&nbsp;:
      </p>
      <ul className="ml-5 list-disc space-y-1">
        <li>la somme des récurrentes assignées (en valeur absolue)&nbsp;;</li>
        <li>le complément, qui couvre les dépenses ou revenus ponctuels.</li>
      </ul>
      <p>
        Sur la page Catégories, dépliez une catégorie pour voir la liste des
        récurrentes qui lui sont rattachées. La page Accueil affiche le
        rapport «&nbsp;réel vs prévu&nbsp;» pour le mois sélectionné&nbsp;:
        somme des opérations de la catégorie comparée à son budget mensuel.
      </p>
      <p>
        Une catégorie peut avoir une <strong>catégorie parente</strong> pour
        regrouper des dépenses apparentées (ex.&nbsp;: <em>Restaurants</em> et
        <em> Courses</em> sous <em>Alimentation</em>). La hiérarchie est limitée
        à un seul niveau, et l'enfant doit avoir le même type que son parent.
        Les sélecteurs de catégorie affichent les sous-catégories indentées
        sous leur parent. Supprimer un parent fait remonter ses enfants au
        niveau racine.
      </p>
      <p>
        Le camembert <em>Dépenses par catégorie</em> ne représente que les
        catégories de type dépense. Les opérations sans catégorie sont totalisées
        à part, en information, pour vous inviter à les classer.
      </p>
      <p>
        Le <em>Taux de dépense</em> exprime la part de vos revenus consommée
        par les dépenses sur la période sélectionnée. En dessous de 100&nbsp;%
        vous épargnez&nbsp;; au-dessus, le solde du mois est négatif. Un
        second chiffre affiche la <strong>moyenne sur les 6 mois pleins
        glissants</strong> (mois courant exclu) comme repère stable.
      </p>
    </Section>
  );
}

function Import() {
  return (
    <Section id="import" title="Import de relevés">
      <p>
        L'import accepte les fichiers <code>.qif</code>, <code>.ofx</code> ou
        un <code>.zip</code> contenant l'un de ces formats. Taille maximum
        1&nbsp;Mo. Il est lancé depuis la page Opérations, banque par banque.
      </p>
      <p>
        Le service de réconciliation procède en trois étapes pour chaque ligne
        du fichier&nbsp;:
      </p>
      <ol className="ml-5 list-decimal space-y-1">
        <li>
          <strong>Détection de doublons stricts</strong>&nbsp;— même libellé,
          banque, montant et date qu'une opération existante.
        </li>
        <li>
          <strong>Réconciliation</strong>&nbsp;— une opération non pointée du
          même compte, avec un montant à ±10&nbsp;%, dans une fenêtre de ±15
          jours, et un libellé suffisamment proche, est pointée et son montant
          aligné sur la valeur du fichier.
        </li>
        <li>
          <strong>Insertion</strong>&nbsp;— sinon une nouvelle opération est
          créée, déjà pointée, avec une catégorie inférée à partir du cache
          d'auto-affectation.
        </li>
      </ol>
      <p>
        Le cache <em>category hints</em> apprend de vos précédentes
        catégorisations&nbsp;: chaque libellé déjà classé devient une indication
        pour les imports suivants. Vous pouvez le réinitialiser ou le
        reconstruire depuis votre profil.
      </p>
    </Section>
  );
}

function Period() {
  return (
    <Section id="period" title="Sélecteur de période">
      <p>
        L'accueil se cale sur un mois entier. Les flèches naviguent au mois
        précédent ou suivant&nbsp;; le bouton «&nbsp;Auj.&nbsp;» revient au
        mois en cours. Le mois sélectionné pilote le budget, le camembert,
        la comparaison vs mois précédent, le taux de dépense et l'analyse
        du mois. Les sélecteurs de période de l'accueil et de la liste
        des opérations sont indépendants.
      </p>
    </Section>
  );
}

function Insights() {
  return (
    <Section id="insights" title="Analyse du mois">
      <p>
        La carte <em>Analyse du mois</em> agrège des signaux automatiques
        sur la période sélectionnée, triés par criticité (rouge → orange
        → bleu → vert)&nbsp;:
      </p>
      <ul className="ml-5 list-disc space-y-1">
        <li>
          <strong>Solde projeté négatif</strong>&nbsp;— sur le mois en
          cours, alerte si la somme des soldes courants + opérations en
          attente jusqu'à la fin du mois passe sous zéro.
        </li>
        <li>
          <strong>Mois déficitaire</strong>&nbsp;— compare revenus et
          dépenses catégorisés ; alerte si le net est négatif.
        </li>
        <li>
          <strong>Catégories en dépassement</strong>&nbsp;— liste les
          catégories de dépense dont le réel franchit le budget prévu.
        </li>
        <li>
          <strong>Rythme de dépenses</strong>&nbsp;— sur le mois en cours,
          confronte le pourcentage de budget consommé au pourcentage du
          mois écoulé. Au-delà de 15 points d'écart, signal d'alerte.
        </li>
        <li>
          <strong>Dépense exceptionnelle</strong>&nbsp;— détecte une
          opération unique au moins 5&nbsp;× la dépense médiane du mois.
          Les opérations issues d'une récurrente (même banque, libellé
          identique ou suffixé après import, montant à ±10&nbsp;%) sont
          exclues.
        </li>
        <li>
          <strong>Comparaison N/N-1</strong>&nbsp;— variation du net
          (revenus − dépenses) supérieure à 25&nbsp;% vs le mois
          précédent.
        </li>
        <li>
          <strong>Opérations sans catégorie</strong>&nbsp;— signal
          qualité de données quand &gt;10&nbsp;% du volume est non
          classé.
        </li>
        <li>
          <strong>Récurrentes non détectées</strong>&nbsp;— sur le mois
          en cours, récurrentes attendues d'après leur jour-du-mois mais
          non identifiées dans les opérations (libellé approchant + même
          banque).
        </li>
        <li>
          <strong>Moyenne ponctuelle historique</strong>&nbsp;— calcule
          sur les 6 mois pleins glissants la dépense moyenne hors
          récurrentes. Alerte si vous êtes au-dessus de cette moyenne
          (proportionnellement au % du mois écoulé), ou si la marge
          restante (solde courant − récurrentes débit à venir) ne couvre
          plus le ponctuel habituel d'ici la fin du mois. Sinon, repère
          d'information sur votre rythme habituel.
        </li>
      </ul>
      <p>
        Les signaux liés au temps réel (rythme, projection, récurrentes
        manquantes) ne sortent que sur le mois en cours. Sur un mois
        passé, seuls les signaux structurels apparaissent.
      </p>
      <p>
        En complément, la carte <em>Évolution du solde mensuel</em> trace
        trois courbes cumulées jour par jour en partant de 0 le 1er du
        mois&nbsp;: trait plein pour le mois sélectionné, pointillé pour
        M-1, pointillé clair pour M-2. Sur le mois en cours, la courbe M
        va jusqu'à la fin du mois en intégrant les opérations futures
        déjà en base (récurrentes générées, ops planifiées). M-2 dépend
        de l'historique 6 mois chargé sur la page&nbsp;: au-delà, sa
        courbe est absente. Transferts internes exclus.
      </p>
    </Section>
  );
}

function Pwa() {
  return (
    <Section id="pwa" title="Installation et mises à jour">
      <p>
        L'application est une PWA&nbsp;: vous pouvez l'installer depuis le
        navigateur sur ordinateur (icône «&nbsp;Installer&nbsp;» dans la barre
        d'adresse) ou sur mobile (option «&nbsp;Ajouter à l'écran d'accueil&nbsp;»).
        Une fois installée, elle se lance comme une application native.
      </p>
      <p>
        Lorsqu'une nouvelle version est mise en ligne, une bannière apparaît
        en bas de la page&nbsp;: cliquer sur <em>Mettre à jour</em> recharge
        l'application avec la dernière version. La détection est automatique
        et passive&nbsp;: l'application interroge le serveur toutes les
        30&nbsp;minutes tant qu'elle est ouverte.
      </p>
      <p>
        Les données restent toujours synchronisées en ligne&nbsp;; la PWA ne
        cache pas les requêtes API afin de garantir des montants frais.
      </p>
    </Section>
  );
}
