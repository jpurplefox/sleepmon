// Tipado mínimo de Google Identity Services (GIS), suficiente para initialize +
// renderButton en modo botón. La lib se carga desde <script> en index.html, no
// hay paquete de tipos oficial instalado — este es el subset que usamos.
export {};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }): void;
          renderButton(
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: number;
            },
          ): void;
          disableAutoSelect(): void;
        };
      };
    };
  }
}
