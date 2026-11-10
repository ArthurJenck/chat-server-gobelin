# Architecture de la portée musicale

Le frontend affiche une portée SVG de cinq lignes sous chaque message du chat. Pour l'instant, l'atelier Leva règle la courbure, l'espacement et l'épaisseur de toutes les portées du channel. GSAP anime le passage d'une valeur à l'autre. Les émotions, le son et les effets liés aux fichiers ne sont pas encore implémentés.

## Organisation

```text
app/routes/channel.tsx
  ├── StaffSettingsPanel.tsx → réglages Leva
  └── MessageStaff.tsx × nombre de messages → cinq tracés SVG
        ├── useStaffAnimation.ts → transition GSAP
        └── staffGeometry.ts → forme des tracés

staffConfig.ts → valeurs par défaut, limites et dimensions partagées
```

Les fichiers de la portée se trouvent dans [`app/staff/`](app/staff/). Chaque composant React a son propre fichier en PascalCase ; les fonctions, le hook et la configuration sont dans des modules séparés.

| Fichier                                                                | Responsabilité                                                                                                  |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [`app/routes/channel.tsx`](app/routes/channel.tsx)                     | Charge les messages, conserve les réglages courants et affiche une portée par message.                          |
| [`app/staff/StaffSettingsPanel.tsx`](app/staff/StaffSettingsPanel.tsx) | Déclare les contrôles Leva et transmet leurs valeurs au channel.                                                |
| [`app/staff/MessageStaff.tsx`](app/staff/MessageStaff.tsx)             | Crée le SVG et ses cinq éléments `<path>`.                                                                      |
| [`app/staff/staffGeometry.ts`](app/staff/staffGeometry.ts)             | Calcule le chemin SVG d'une ligne à partir de son index et des réglages.                                        |
| [`app/staff/useStaffAnimation.ts`](app/staff/useStaffAnimation.ts)     | Anime les réglages avec GSAP et met à jour les tracés pendant la transition.                                    |
| [`app/staff/staffConfig.ts`](app/staff/staffConfig.ts)                 | Regroupe le type des réglages, leurs valeurs par défaut, leurs limites, les dimensions et la durée d'animation. |

## Trajet d'un réglage

Le channel conserve les réglages communs aux messages. Quand un contrôle Leva change, `StaffSettingsPanel` transmet les nouvelles valeurs ; chaque `MessageStaff` les reçoit ensuite :

```tsx
const [staffSettings, setStaffSettings] = useState(DEFAULT_STAFF_SETTINGS)

<StaffSettingsPanel onChange={setStaffSettings} />
<MessageStaff user={message.user} settings={staffSettings} />
```

Les valeurs par défaut et les bornes du panneau viennent de `staffConfig.ts`. Ainsi, la valeur initiale affichée par Leva correspond à celle utilisée par les portées avant toute interaction.

## Du réglage au SVG

`staffGeometry.ts` calcule la hauteur de chaque ligne autour du centre de la portée. La courbure déplace ensuite les points de contrôle de la courbe ; les cinq lignes utilisent le même calcul.

```ts
const middleLine = (STAFF_GEOMETRY.lineCount - 1) / 2;
const y = STAFF_GEOMETRY.height / 2 + (index - middleLine) * settings.spacing;
```

`MessageStaff` fournit les cinq `<path>` et leurs références au hook. GSAP interpole un objet de valeurs numériques ; à chaque mise à jour, le hook recalcule l'attribut `d` des lignes avec `getStaffLinePath` et ajuste leur épaisseur :

```ts
gsap.to(currentSettings.current, {
    ...settings,
    duration: STAFF_ANIMATION.duration,
    onUpdate: () => {
        paths.current.forEach((path, index) => {
            path?.setAttribute(
                "d",
                getStaffLinePath(index, currentSettings.current),
            );
        });
    },
});
```

Le hook arrête la transition précédente quand les réglages changent ou que la portée disparaît. Les images intermédiaires sont appliquées directement au SVG, sans déclencher un rendu React à chaque image.

## Étendre la portée

Pour ajouter un réglage global, définir son type, sa valeur par défaut et ses bornes dans `staffConfig.ts`, l'exposer dans `StaffSettingsPanel.tsx`, puis l'utiliser dans la géométrie ou l'animation. Les contrôles actuels affectent toutes les portées de la même façon. Une future émotion ou un effet propre à un message devra produire des valeurs **pour ce message**, distinctes des réglages globaux de l'atelier.

Le parcours existant est vérifié par [`test/chat.test.tsx`](test/chat.test.tsx) : cinq lignes par message et déformation après modification de la courbure. Depuis `web/`, lancer `pnpm test`, `pnpm typecheck` ou `pnpm build` selon le contrôle souhaité.
