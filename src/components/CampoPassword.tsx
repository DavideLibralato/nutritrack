"use client";

// Un campo password con l'occhio per vederla (mockup
// docs/mockups/testata-login.html): etichetta, campo e, dentro il campo a
// destra, un pulsante da 40×40 px. Nelle quattro pagine di accesso, uno per
// campo.
//
// Funziona con i due tipi di campo:
// - "controllato" (Accedi, Reimposta): si passano `value` e `onChange`, il
//   valore sta nello stato della pagina;
// - "non controllato" (Registrati): si passa solo `name`, il valore lo tiene
//   il browser e la Server Action lo legge all'invio. L'occhio cambia solo
//   l'attributo `type`: il browser tiene quello che c'è scritto, e la
//   password non entra mai nello stato di React.
//
// Le regole, con un test permanente (CampoPassword.test.tsx):
// - type="button": dentro un <form> un <button> senza tipo invia il modulo;
// - etichetta fissa "Mostra password" con aria-pressed: lo screen reader
//   dice "Mostra password, attivato/non attivato". Un'etichetta che cambia
//   insieme ad aria-pressed ("Nascondi password, attivato") non si capirebbe;
// - all'invio del modulo la password torna nascosta (type="password"), così
//   il gestore delle password (Portachiavi iCloud) trova all'invio un campo
//   password, come se l'occhio non fosse mai stato toccato.

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

export default function CampoPassword({
  id,
  etichetta,
  autoComplete,
  placeholder,
  name,
  value,
  onChange,
}: {
  id: string;
  etichetta: string;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  name?: string;
  value?: string;
  onChange?: (valore: string) => void;
}) {
  const [visibile, setVisibile] = useState(false);
  // Il campo vero nella pagina: serve per trovare il suo modulo e per
  // rimettere il cursore dov'era dopo il cambio di tipo.
  const campo = useRef<HTMLInputElement>(null);

  // All'invio si nasconde. Ascoltando l'evento "submit" del modulo, invece
  // di chiedere a ogni pagina di farlo nel suo invio, vale uguale con
  // onSubmit (Accedi, Reimposta) e con action (Registrati). Questo
  // ascoltatore sta sul modulo, quindi parte prima di quello di React.
  // flushSync: React aggiorna la pagina subito, non al giro successivo,
  // e il campo è già di nuovo "password" mentre l'invio va avanti.
  useEffect(() => {
    const modulo = campo.current?.form;
    if (!modulo) return;
    function allInvio() {
      flushSync(() => setVisibile(false));
    }
    modulo.addEventListener("submit", allInvio);
    return () => modulo.removeEventListener("submit", allInvio);
  }, []);

  function cambiaVisibilita() {
    const el = campo.current;
    // Il cursore: cambiando tipo, alcuni browser lo spostano in fondo o
    // all'inizio. Si ricorda e si rimette, solo se si stava scrivendo.
    const aFuoco = el !== null && document.activeElement === el;
    const inizio = aFuoco ? el.selectionStart : null;
    const fine = aFuoco ? el.selectionEnd : null;
    flushSync(() => setVisibile((v) => !v));
    if (el && inizio !== null && fine !== null) el.setSelectionRange(inizio, fine);
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {etichetta}
      </label>
      <div className="relative">
        <input
          ref={campo}
          id={id}
          name={name}
          type={visibile ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          // Con la password visibile il campo è di testo, e iPhone ci
          // metterebbe la maiuscola iniziale e la correzione automatica:
          // spente sempre, anche da nascosta (lì non cambiano niente).
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          // Senza value (Registrati) React lascia il campo al browser.
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className={`w-full rounded-lg border border-border p-2 pr-11 ${CLASSE_FOCUS}`}
        />
        <button
          type="button"
          aria-label="Mostra password"
          aria-pressed={visibile}
          aria-controls={id}
          // Il tocco non toglie il fuoco al campo: su iPhone la tastiera
          // resta aperta e si continua a scrivere. Il click arriva lo stesso.
          onPointerDown={(e) => e.preventDefault()}
          onClick={cambiaVisibilita}
          className={`absolute right-0.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:text-foreground ${CLASSE_FOCUS}`}
        >
          {visibile ? <OcchioBarrato /> : <OcchioAperto />}
        </button>
      </div>
    </div>
  );
}

// Le due icone del mockup, nel colore del pulsante (currentColor).
function OcchioAperto() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function OcchioBarrato() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
