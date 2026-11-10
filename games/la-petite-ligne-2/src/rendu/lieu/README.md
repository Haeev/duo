# Lieu courant (lot L4)

Tout ce qui appartient au lieu affiché: `description.ts` traduit les données et l'état du lieu en volumes (logique pure), `formes.ts` fabrique les formes provisoires quand le modèle manque, `lieu.ts` construit la scène du lieu et la libère en entier au départ (un `ResourceTracker` par lieu, ADR 0018). Les modèles livrés arrivent par `ModelSource` (`lieu.ts`): le moteur ne connaît aucun nom de modèle.
