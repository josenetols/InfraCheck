import { LocationStatus } from '../types';

/** Prazo de validade de um checklist em dias */
export const VALIDITY_DAYS = 30;

/** Dias restantes que indicam estado de alerta */
export const WARNING_THRESHOLD_DAYS = 5;

/**
 * Calcula o status de validade de um checklist a partir da data da última visita.
 * Fonte única de verdade para toda a aplicação — não duplicar esta lógica.
 */
export const getChecklistStatus = (lastCheckDate: string | null): Pick<
  LocationStatus,
  'isValid' | 'isWarning' | 'daysRemaining'
> => {
  if (!lastCheckDate) {
    return { isValid: false, isWarning: false, daysRemaining: null };
  }

  const diffMs = Date.now() - new Date(lastCheckDate).getTime();
  const diffDays = Math.floor(diffMs / 86_400_000); // ms → dias

  const isValid = diffDays <= VALIDITY_DAYS;
  const daysRemaining = isValid ? VALIDITY_DAYS - diffDays : null;
  const isWarning = isValid && (daysRemaining ?? 0) <= WARNING_THRESHOLD_DAYS;

  return { isValid, isWarning, daysRemaining };
};

/**
 * Calcula quantos dias de atraso uma loja tem (retorna 0 se estiver em dia).
 */
export const getDaysOverdue = (lastCheckDate: string | null): number => {
  if (!lastCheckDate) return 999; // Nunca realizado — pior caso
  const diffDays = Math.floor((Date.now() - new Date(lastCheckDate).getTime()) / 86_400_000);
  return diffDays > VALIDITY_DAYS ? diffDays - VALIDITY_DAYS : 0;
};
