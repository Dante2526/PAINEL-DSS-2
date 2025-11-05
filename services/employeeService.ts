import { Timestamp } from 'firebase/firestore';

// Helper function to format Firestore Timestamp or string
export const formatTimestamp = (time: Timestamp | string | null): string => {
    if (!time) return '--:--';
    if (typeof time === 'string') return time;
    // Duck-typing for Firebase Timestamp is more robust than `instanceof`
    if (time && typeof (time as any).toDate === 'function') {
        const date = (time as Timestamp).toDate();
        return `${date.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric'})} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return '--:--';
};
