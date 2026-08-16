"use client";

import { useEffect, useRef } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";

type Props = {
  onCodiceTrovato: (codice: string) => void;
};

export default function ScannerBarcode({ onCodiceTrovato }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const avviatoRef = useRef(false);

  useEffect(() => {
    if (avviatoRef.current) return;
    avviatoRef.current = true;

    const scanner = new Html5Qrcode("area-scanner-pasto");
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 300, height: 200 },
          videoConstraints: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        (testoDecodificato) => {
          onCodiceTrovato(testoDecodificato);
          if (scanner.getState() === Html5QrcodeScannerState.SCANNING) {
            scanner.stop().catch(() => {});
          }
        },
        () => {}
      )
      .catch(() => {
        // Se la fotocamera non è disponibile, l'utente userà comunque il campo manuale
      });

    return () => {
      if (scanner.getState() === Html5QrcodeScannerState.SCANNING) {
        scanner.stop().catch(() => {});
      }
    };
  }, [onCodiceTrovato]);

  return <div id="area-scanner-pasto" className="w-full" />;
}