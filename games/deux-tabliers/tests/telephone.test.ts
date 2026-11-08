// Navigation du téléphone (ux-telephone 4): pile, appli voisine en boucle, nuit, messages.
import { describe, expect, it } from 'vitest';
import {
  addMessage,
  createPhoneState,
  currentScreen,
  markRead,
  neighbourApp,
  popScreen,
  pushScreen,
  resetForNight,
  switchApp,
  unread,
} from '../src/interface/telephone-etat';

describe('téléphone', () => {
  it('Retour arrière revient d’un cran jusqu’à l’accueil, puis range', () => {
    const s = createPhoneState();
    pushScreen(s, { app: 'messages' });
    pushScreen(s, { app: 'messages', thread: 'partner' });
    expect(currentScreen(s)).toEqual({ app: 'messages', thread: 'partner' });
    expect(popScreen(s)).toBe(true);
    expect(currentScreen(s).app).toBe('messages');
    expect(popScreen(s)).toBe(true);
    expect(currentScreen(s).app).toBe('home');
    expect(popScreen(s)).toBe(false);
  });

  it('A et E bouclent dans l’ordre de l’accueil, accueil compris', () => {
    expect(neighbourApp('home', 1)).toBe('orders');
    expect(neighbourApp('home', -1)).toBe('settings');
    expect(neighbourApp('settings', 1)).toBe('home');
    const s = createPhoneState();
    pushScreen(s, { app: 'orders' });
    pushScreen(s, { app: 'orders' });
    expect(s.stack).toHaveLength(1);
    expect(switchApp(s, 1)).toBe('stock');
    expect(switchApp(s, -1)).toBe('orders');
    expect(switchApp(s, -1)).toBe('home');
    expect(s.stack).toHaveLength(0);
  });

  it('la nuit ramène à l’accueil; les messages gardent leur état de lecture', () => {
    const s = createPhoneState();
    pushScreen(s, { app: 'catalogue' });
    s.scroll.set('catalogue', 120);
    resetForNight(s);
    expect(currentScreen(s).app).toBe('home');
    expect(s.scroll.size).toBe(0);
    addMessage(s, 'suppliers', 'La commande est arrivée à la porte de service.', 3, 420);
    addMessage(s, 'regulars', 'Bastien arrive', 3, 600);
    expect(unread(s)).toBe(2);
    markRead(s, 'suppliers');
    expect(unread(s)).toBe(1);
    expect(unread(s, 'regulars')).toBe(1);
  });
});
