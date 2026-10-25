// Il cerchio di una persona: la foto profilo se c'è, altrimenti le
// iniziali (PUNTO_DI_PARTENZA.md §3, "La foto profilo"). Lo usano
// IntestazioneProfilo (56 px), SchedaAccount (52 px), RigaAmico e il foglio
// "Condividi con" (38 px). Misure e colori del cerchio li passa chi lo
// usa (`classe`, da variabili CSS): sono quelli delle iniziali di oggi, e
// il colore di fondo resta sotto la foto mentre si carica.
//
// Solo decorativo per lo screen reader (aria-hidden, alt vuoto), come le
// iniziali di oggi: in tutti e quattro i posti il nome è già scritto
// accanto, e leggerlo due volte ("Foto di @marco, @marco") sarebbe solo
// rumore.
//
// Un <img> semplice e non next/image: l'indirizzo è locale ("blob:…") o
// firmato dallo Storage, già della misura giusta. Se l'immagine non si
// carica (indirizzo firmato scaduto, file tolto) tornano le iniziali.

import { useState, type ReactNode } from "react";

export default function CerchioFoto({
  indirizzo,
  iniziali,
  classe,
}: {
  indirizzo: string | null | undefined;
  iniziali: ReactNode;
  classe: string;
}) {
  // L'indirizzo che non si è caricato: per quello, le iniziali. Un
  // indirizzo nuovo riprova da solo.
  const [rotto, setRotto] = useState<string | null>(null);
  const conFoto = Boolean(indirizzo) && indirizzo !== rotto;

  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full ${classe}`}
    >
      {conFoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- vedi il commento in cima
        <img
          src={indirizzo!}
          alt=""
          className="size-full object-cover"
          onError={() => setRotto(indirizzo!)}
        />
      ) : (
        iniziali
      )}
    </span>
  );
}
