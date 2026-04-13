import { defaultLocale, type Locale } from "@/features/i18n/config";

const dictionaries = {
  es: {
    common: {
      role: {
        owner: "owner",
        member: "member",
      },
      actions: {
        save: "Guardar",
        cancel: "Cancelar",
        retry: "Reintentar",
        signOut: "Salir",
        closeSession: "Cerrar sesión",
      },
      messages: {
        loading: "Cargando...",
      },
    },
    nav: {
      summary: "Resumen",
      insights: "Insights",
      budget: "Presupuesto",
      transactions: "Transacciones",
      categories: "Categorías",
      paymentMethods: "Medios de pago",
      settings: "Configuración",
      expandMenu: "Expandir menú",
      collapseMenu: "Colapsar menú",
      activeRole: "Rol activo: {{role}}",
    },
    auth: {
      login: {
        title: "Ingresar",
        subtitle: "Entrá a Encaja para administrar tu presupuesto familiar.",
        emailLabel: "Email",
        emailPlaceholder: "nombre@email.com",
        passwordLabel: "Contraseña",
        passwordPlaceholder: "********",
        submit: "Iniciar sesión",
        noAccount: "¿Todavía no tenés cuenta?",
        goToRegister: "Registrate",
        fallback: "Cargando formulario...",
        successTitle: "Bienvenido",
        successMessage: "Sesión iniciada correctamente.",
        errorTitle: "No pudimos iniciar sesión",
      },
      register: {
        title: "Crear cuenta",
        subtitle: "Registrate para iniciar tu espacio de gestión financiera.",
        fullNameLabel: "Nombre (opcional)",
        fullNamePlaceholder: "Juan",
        emailLabel: "Email",
        emailPlaceholder: "nombre@email.com",
        passwordLabel: "Contraseña",
        passwordPlaceholder: "********",
        submit: "Crear cuenta",
        hasAccount: "¿Ya tenés cuenta?",
        goToLogin: "Ingresá",
        createdTitle: "Cuenta creada",
        createdConfirmEmail: "Revisá tu email para confirmar la cuenta y luego ingresá.",
        bootstrapErrorTitle: "No pudimos preparar tu workspace",
        bootstrapErrorFallback: "Ocurrió un error inesperado durante el bootstrap.",
        workspaceReady: "Tu workspace inicial ya está listo.",
        createErrorTitle: "No pudimos crear la cuenta",
      },
      validation: {
        invalidEmail: "Ingresá un email válido.",
        passwordMinLength: "La contraseña debe tener al menos 6 caracteres.",
        fullNameMaxLength: "El nombre no puede superar 120 caracteres.",
      },
    },
    workspace: {
      loading: "Preparando tus workspaces...",
      sessionErrorTitle: "No pudimos cargar tu sesión",
      sessionErrorFallback: "No encontramos un workspace asociado.",
      backToLogin: "Volver a ingresar",
      initializingError: "No pudimos inicializar el workspace.",
      refreshError: "No pudimos refrescar workspaces.",
      noSessionAvailable: "Tu sesión no está disponible.",
      noWorkspaceAssociated: "No encontramos un workspace asociado.",
      needActiveWorkspace: "Necesitás al menos un workspace activo.",
      openWorkspace: "Abriendo tu workspace...",
      developedBy: "Desarrollado por Juan Pardo",
      signOutTooltip: "Salir",
    },
    settings: {
      language: {
        title: "Idioma de la app",
        description:
          "Este idioma aplica a los textos del sistema y se guarda en tu perfil de usuario.",
        fieldLabel: "Idioma",
        spanishOption: "Español",
        englishOption: "Inglés",
        saveButton: "Guardar idioma",
        savedTitle: "Idioma actualizado",
        savedMessage: "Tu preferencia de idioma se guardó correctamente.",
        errorTitle: "No pudimos actualizar idioma",
      },
    },
  },
  en: {
    common: {
      role: {
        owner: "owner",
        member: "member",
      },
      actions: {
        save: "Save",
        cancel: "Cancel",
        retry: "Retry",
        signOut: "Sign out",
        closeSession: "Close session",
      },
      messages: {
        loading: "Loading...",
      },
    },
    nav: {
      summary: "Overview",
      insights: "Insights",
      budget: "Budget",
      transactions: "Transactions",
      categories: "Categories",
      paymentMethods: "Payment methods",
      settings: "Settings",
      expandMenu: "Expand menu",
      collapseMenu: "Collapse menu",
      activeRole: "Active role: {{role}}",
    },
    auth: {
      login: {
        title: "Log in",
        subtitle: "Sign in to Encaja to manage your household budget.",
        emailLabel: "Email",
        emailPlaceholder: "name@email.com",
        passwordLabel: "Password",
        passwordPlaceholder: "********",
        submit: "Log in",
        noAccount: "Don't have an account yet?",
        goToRegister: "Sign up",
        fallback: "Loading form...",
        successTitle: "Welcome",
        successMessage: "Session started successfully.",
        errorTitle: "We couldn't sign you in",
      },
      register: {
        title: "Create account",
        subtitle: "Sign up to start your financial management workspace.",
        fullNameLabel: "Name (optional)",
        fullNamePlaceholder: "John",
        emailLabel: "Email",
        emailPlaceholder: "name@email.com",
        passwordLabel: "Password",
        passwordPlaceholder: "********",
        submit: "Create account",
        hasAccount: "Already have an account?",
        goToLogin: "Log in",
        createdTitle: "Account created",
        createdConfirmEmail: "Check your email to confirm your account, then log in.",
        bootstrapErrorTitle: "We couldn't prepare your workspace",
        bootstrapErrorFallback: "An unexpected error happened during bootstrap.",
        workspaceReady: "Your initial workspace is ready.",
        createErrorTitle: "We couldn't create your account",
      },
      validation: {
        invalidEmail: "Enter a valid email.",
        passwordMinLength: "Password must be at least 6 characters.",
        fullNameMaxLength: "Name cannot exceed 120 characters.",
      },
    },
    workspace: {
      loading: "Preparing your workspaces...",
      sessionErrorTitle: "We couldn't load your session",
      sessionErrorFallback: "We couldn't find an associated workspace.",
      backToLogin: "Sign in again",
      initializingError: "We couldn't initialize your workspace.",
      refreshError: "We couldn't refresh your workspaces.",
      noSessionAvailable: "Your session is not available.",
      noWorkspaceAssociated: "We couldn't find an associated workspace.",
      needActiveWorkspace: "You need at least one active workspace.",
      openWorkspace: "Opening your workspace...",
      developedBy: "Developed by Juan Pardo",
      signOutTooltip: "Sign out",
    },
    settings: {
      language: {
        title: "App language",
        description: "This language applies to system texts and is stored in your user profile.",
        fieldLabel: "Language",
        spanishOption: "Spanish",
        englishOption: "English",
        saveButton: "Save language",
        savedTitle: "Language updated",
        savedMessage: "Your language preference was saved successfully.",
        errorTitle: "We couldn't update your language",
      },
    },
  },
} as const;

type DictionaryNode = Record<string, unknown>;

function lookupInDictionary(dictionary: DictionaryNode, key: string): string | null {
  const segments = key.split(".");
  let current: unknown = dictionary;

  for (const segment of segments) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return null;
    }

    current = (current as DictionaryNode)[segment];
  }

  return typeof current === "string" ? current : null;
}

function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => {
    const replacement = values[token];
    if (replacement === undefined) {
      return "";
    }

    return String(replacement);
  });
}

export function getTranslation(
  locale: Locale,
  key: string,
  fallback?: string,
  values?: Record<string, string | number>,
): string {
  const localized = lookupInDictionary(dictionaries[locale], key);
  if (localized) {
    return interpolate(localized, values);
  }

  const defaultLocalized = locale === defaultLocale ? null : lookupInDictionary(dictionaries.es, key);
  if (defaultLocalized) {
    return interpolate(defaultLocalized, values);
  }

  if (fallback) {
    return interpolate(fallback, values);
  }

  return key;
}
