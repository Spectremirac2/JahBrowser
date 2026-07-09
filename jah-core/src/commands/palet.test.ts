import { describe, expect, it } from 'vitest';
import { MockEngineAdapter } from '../engine/mock.js';
import { CommandRegistry, type JahCommand } from './palet.js';

const noop = () => {};

function cmd(overrides: Partial<JahCommand> & { id: string; title: string }): JahCommand {
  return { run: noop, ...overrides };
}

async function freshRegistry(engine = new MockEngineAdapter()): Promise<CommandRegistry> {
  const registry = new CommandRegistry(engine);
  await registry.init();
  return registry;
}

describe('CommandRegistry — search ranking', () => {
  it('ranks title prefix > word-start > substring > keyword, regardless of registration order', async () => {
    const registry = await freshRegistry();
    // kayıt sırası kasıtlı olarak ters: sıralama rank'ten gelmeli
    registry.register(cmd({ id: 'keyword', title: 'Yayını Aç', keywords: ['izleme'] }));
    registry.register(cmd({ id: 'substring', title: 'Gizle Panelini' })); // "g-izle"
    registry.register(cmd({ id: 'word-start', title: 'Sonra İzle' }));
    registry.register(cmd({ id: 'prefix', title: 'İzlemeye Geç' }));

    const ids = registry.search('izle').map((c) => c.id);
    expect(ids).toEqual(['prefix', 'word-start', 'substring', 'keyword']);
  });

  it('folds case via tr-TR: dotted/dotless I both ways', async () => {
    const registry = await freshRegistry();
    registry.register(cmd({ id: 'izle', title: 'İzlemeye Geç' }));
    registry.register(cmd({ id: 'isik', title: 'Işıkları Kapat' }));

    // "izle" küçük harf sorgusu İ ile başlayan başlığı bulur (İ → i)
    expect(registry.search('izle').map((c) => c.id)).toEqual(['izle']);
    // BÜYÜK I sorgusu tr-TR'de ı'ya iner; düz toLowerCase (I → i) bunu kaçırırdı
    expect(registry.search('IŞIK').map((c) => c.id)).toEqual(['isik']);
    expect(registry.search('İZLEMEYE').map((c) => c.id)).toEqual(['izle']);
  });

  it('breaks equal-rank ties by registration order (stable)', async () => {
    const registry = await freshRegistry();
    registry.register(cmd({ id: 'first', title: 'Klip Al' }));
    registry.register(cmd({ id: 'second', title: 'Klip Paylaş' }));

    expect(registry.search('klip').map((c) => c.id)).toEqual(['first', 'second']);
  });

  it('filters out unavailable commands and returns nothing for non-matching queries', async () => {
    const registry = await freshRegistry();
    registry.register(cmd({ id: 'hidden', title: 'Klip Al', isAvailable: () => false }));
    registry.register(cmd({ id: 'shown', title: 'Klip Paylaş', isAvailable: () => true }));

    expect(registry.search('klip').map((c) => c.id)).toEqual(['shown']);
    expect(registry.search('').map((c) => c.id)).toEqual(['shown']);
    expect(registry.search('yok böyle bir komut')).toEqual([]);
  });

  it('empty query lists MRU first, remaining sorted by title (tr-TR)', async () => {
    const registry = await freshRegistry();
    registry.register(cmd({ id: 'c', title: 'Çentik Bırak' }));
    registry.register(cmd({ id: 'a', title: 'Ayarları Aç' }));
    registry.register(cmd({ id: 's', title: 'Ses Masası' }));

    // MRU boş: salt başlık sıralaması (tr-TR: Ayarları < Çentik < Ses)
    expect(registry.search('').map((c) => c.id)).toEqual(['a', 'c', 's']);

    await registry.execute('s');
    await registry.execute('c'); // en son çalışan en önde
    expect(registry.search('').map((c) => c.id)).toEqual(['c', 's', 'a']);
  });
});

describe('CommandRegistry — register/unregister', () => {
  it('throws on duplicate id', async () => {
    const registry = await freshRegistry();
    registry.register(cmd({ id: 'dup', title: 'Bir' }));
    expect(() => registry.register(cmd({ id: 'dup', title: 'İki' }))).toThrow(
      'command already registered: dup',
    );
  });

  it('unregister removes the command; the id becomes reusable', async () => {
    const registry = await freshRegistry();
    const unsub = registry.register(cmd({ id: 'x', title: 'Eski Komut' }));
    unsub();
    expect(registry.search('eski')).toEqual([]);
    await expect(registry.execute('x')).rejects.toThrow('no such command: x');

    registry.register(cmd({ id: 'x', title: 'Yeni Komut' }));
    unsub(); // stale unsubscribe: yeni kaydı SİLMEMELİ
    expect(registry.search('yeni').map((c) => c.title)).toEqual(['Yeni Komut']);
  });
});

describe('CommandRegistry — execute + MRU persistence', () => {
  it('runs the command and refuses unavailable ones', async () => {
    const registry = await freshRegistry();
    let ran = 0;
    registry.register(cmd({ id: 'run-me', title: 'Çalıştır', run: () => void ran++ }));
    registry.register(cmd({ id: 'off', title: 'Kapalı', isAvailable: () => false }));

    await registry.execute('run-me');
    expect(ran).toBe(1);
    await expect(registry.execute('off')).rejects.toThrow('command not available: off');
  });

  it('does not gain MRU recency when run() throws', async () => {
    const engine = new MockEngineAdapter();
    const registry = await freshRegistry(engine);
    registry.register(cmd({ id: 'ok', title: 'Sağlam' }));
    registry.register(
      cmd({
        id: 'broken',
        title: 'Bozuk',
        run: () => {
          throw new Error('patladı');
        },
      }),
    );

    await registry.execute('ok');
    await expect(registry.execute('broken')).rejects.toThrow('patladı');
    expect(registry.search('').map((c) => c.id)).toEqual(['ok', 'broken']);
    expect(await engine.storage.get<string[]>('palet:mru')).toEqual(['ok']);
  });

  it('persists MRU to "palet:mru" and a second registry instance hydrates it', async () => {
    const engine = new MockEngineAdapter();
    const first = await freshRegistry(engine);
    first.register(cmd({ id: 'a', title: 'Ayarları Aç' }));
    first.register(cmd({ id: 'k', title: 'Klip Al' }));
    await first.execute('k');
    expect(await engine.storage.get<string[]>('palet:mru')).toEqual(['k']);

    // yeni oturum simülasyonu: aynı storage, taze registry
    const second = await freshRegistry(engine);
    second.register(cmd({ id: 'a', title: 'Ayarları Aç' }));
    second.register(cmd({ id: 'k', title: 'Klip Al' }));
    expect(second.search('').map((c) => c.id)).toEqual(['k', 'a']);
  });

  it('MRU boosts ties within the same rank after execute', async () => {
    const registry = await freshRegistry();
    // ikisi de word-start eşleşmesi (rank eşit): MRU aralarında belirleyici
    registry.register(cmd({ id: 'first', title: 'Sonra Klip Al' }));
    registry.register(cmd({ id: 'second', title: 'Sonra Klip Paylaş' }));

    await registry.execute('second');
    expect(registry.search('klip').map((c) => c.id)).toEqual(['second', 'first']);
    // ama rank her zaman MRU'dan önce gelir: prefix eşleşmesi öne geçer
    registry.register(cmd({ id: 'exact', title: 'Klip Al' }));
    expect(registry.search('klip').map((c) => c.id)).toEqual(['exact', 'second', 'first']);
  });

  it('caps the persisted MRU at 50 entries', async () => {
    const engine = new MockEngineAdapter();
    const registry = await freshRegistry(engine);
    for (let i = 0; i < 55; i++) {
      registry.register(cmd({ id: `c${i}`, title: `Komut ${i}` }));
    }
    for (let i = 0; i < 55; i++) await registry.execute(`c${i}`);

    const stored = (await engine.storage.get<string[]>('palet:mru')) ?? [];
    expect(stored).toHaveLength(50);
    expect(stored[0]).toBe('c54'); // en yeni başta
    expect(stored).not.toContain('c0'); // en eskiler düştü
  });

  it('ignores stale MRU ids that are no longer registered', async () => {
    const engine = new MockEngineAdapter();
    await engine.storage.set('palet:mru', ['ghost', 'k']);
    const registry = await freshRegistry(engine);
    registry.register(cmd({ id: 'k', title: 'Klip Al' }));
    registry.register(cmd({ id: 'a', title: 'Ayarları Aç' }));

    expect(registry.search('').map((c) => c.id)).toEqual(['k', 'a']);
  });
});
