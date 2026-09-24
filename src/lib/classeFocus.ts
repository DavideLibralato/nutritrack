// Classe Tailwind condivisa per l'indicatore di focus da tastiera (visibile
// solo con `focus-visible`, non al tap/click). Un anello DENTRO il bordo del
// campo (box-shadow inset) invece di un `outline` — che CSS disegna sempre
// FUORI dal bordo. Due problemi, stessa causa:
//
// 1. Su un campo con `border-radius` l'outline non segue gli angoli
//    arrotondati (sbordava visibilmente dai lati).
// 2. Se il campo sta dentro un contenitore con scroll (`overflow-y-auto`),
//    quel contenitore taglia anche in orizzontale qualunque cosa esca dai
//    suoi bordi — per le regole CSS sull'overflow, impostare uno solo dei due
//    assi (qui `overflow-y`) rende `auto` anche l'altro. L'outline che sporge
//    a sinistra/destra veniva quindi tagliato lì, non solo sul campo stesso
//    (bug "l'anello di focus sborda dal campo", verificato in
//    CreaAlimentoForm dentro l'area scrollabile di /aggiungi).
//
// Un anello interno non sporge mai dal riquadro del campo: niente da tagliare,
// niente angoli scoperti. Colore dalla variabile CSS d'accento (--color-accent
// in globals.css), non scritto a mano (sezione 7 di CLAUDE.md).
//
// ATTENZIONE Tailwind 4: qui NON si usa `ring-inset` (sintassi v3, in questo
// progetto — tailwindcss "^4" — non genera nessuna regola: la classe viene
// scritta nell'HTML ma il CSS corrispondente non esiste, quindi non succede
// niente in silenzio). L'anello interno in v4 è un'utility a parte,
// `inset-ring-*`, non una variante di `ring-*`.
//
// `outline-hidden`, non `outline-none`: un `ring`/`inset-ring` è una
// box-shadow, non un outline, quindi non sostituisce più il contorno di
// focus di sistema del browser (azzurro su Safari) come faceva il vecchio
// `outline` — i due restavano visibili insieme. `outline-hidden` è l'utility
// che in Tailwind 4 nasconde quel contorno mantenendo `outline: 2px solid
// transparent` (visibile in modalità forced-colors/alto contrasto, la parte
// accessibile). `outline-none` esiste ancora in v4 ma da v4 in poi vuol dire
// un'altra cosa: `outline-style: none` puro, che sparisce anche in
// forced-colors — è la vecchia sintassi v3 con un significato nuovo, non va
// usata qui.
export const CLASSE_FOCUS =
  "focus-visible:inset-ring-2 focus-visible:inset-ring-accent focus-visible:outline-hidden";
