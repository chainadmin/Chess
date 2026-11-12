import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { PieceView } from '../components/PieceView';
import { purchaseService, StoreProduct } from '../services/purchases/PurchaseService';
import { useEntitlements } from '../services/purchases/entitlements';
import { PRODUCT_IDS, ProductId } from '../services/purchases/products';
import { theme } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Shop'>;
type Item = { id: ProductId; name: string; detail: string; best?: boolean; preview: 'ads' | 'modern' | 'tournament' | 'all' };
const ITEMS: Item[] = [
  { id: PRODUCT_IDS.everything, name: 'Everything Pack', detail: 'Remove ads + Forged Metal + Royal Lacquer pieces', best: true, preview: 'all' },
  { id: PRODUCT_IDS.removeAds, name: 'Remove Ads', detail: 'No more ads between games, forever', preview: 'ads' },
  { id: PRODUCT_IDS.forgedMetal, name: 'Forged Metal Pieces', detail: 'Sculpted silver and gunmetal piece set', preview: 'modern' },
  { id: PRODUCT_IDS.royalLacquer, name: 'Royal Lacquer Pieces', detail: 'Royal blue lacquer, ivory and gold inlay', preview: 'tournament' },
];

function Preview({ kind }: { kind: Item['preview'] }) {
  if (kind === 'ads') return <View style={styles.preview}><Text style={styles.adsIcon}>🚫</Text><Text style={styles.adsText}>ADS</Text></View>;
  if (kind === 'all') return <View style={styles.preview}>
    <PieceView type="K" color="white" set="modern" size={30} /><PieceView type="K" color="black" set="tournament" size={30} />
  </View>;
  return <View style={styles.preview}><PieceView type="K" color="white" set={kind} size={30} /><PieceView type="S" color="black" set={kind} size={30} /></View>;
}

export function ShopScreen(_props: Props) {
  const owned = useEntitlements();
  const [products, setProducts] = useState<StoreProduct[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ProductId | 'restore' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(() => {
    if (!purchaseService.available) { setProducts([]); return; }
    setLoadError(null);
    purchaseService.products().then(setProducts).catch(() => { setProducts([]); setLoadError('Could not reach the store. Check your connection and try again.'); });
  }, []);
  useFocusEffect(load);

  const ownsItem = (id: ProductId) => id === PRODUCT_IDS.removeAds ? owned.adsRemoved
    : id === PRODUCT_IDS.forgedMetal ? owned.premiumPieceSets.includes('modern')
    : id === PRODUCT_IDS.royalLacquer ? owned.premiumPieceSets.includes('tournament')
    : owned.adsRemoved && owned.premiumPieceSets.length === 2;
  // The bundle only makes sense before buying any part of it.
  const visible = ITEMS.filter(item => item.id !== PRODUCT_IDS.everything || (!owned.adsRemoved && owned.premiumPieceSets.length === 0));
  const buy = async (item: Item) => {
    setBusy(item.id); setMessage(null);
    try {
      if (item.id === PRODUCT_IDS.everything) await purchaseService.purchaseEverything();
      else if (item.id === PRODUCT_IDS.removeAds) await purchaseService.purchaseRemoveAds();
      else await purchaseService.purchasePieceSet(item.id === PRODUCT_IDS.forgedMetal ? 'modern' : 'tournament');
      setMessage(item.id === PRODUCT_IDS.removeAds ? 'Ads removed. Thank you!' : `${item.name} unlocked. Thank you! Equip it in Boards & pieces.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The purchase did not complete.'); }
    finally { setBusy(null); }
  };
  const restore = async () => {
    setBusy('restore'); setMessage(null);
    try { await purchaseService.restorePurchases(); setMessage('Purchases restored.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Nothing to restore.'); }
    finally { setBusy(null); }
  };

  return <Screen><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Text style={styles.eyebrow}>OPTIONAL EXTRAS</Text>
    <Text style={styles.title}>Shop</Text>
    <Text style={styles.intro}>Everything in ShiftChess is free to play. These are cosmetic or remove ads; none give a gameplay advantage. One-time purchases, yours to keep.</Text>
    {!purchaseService.available && <View style={styles.notice}><Text style={styles.noticeText}>{purchaseService.unavailableReason}</Text></View>}
    {!!loadError && <View style={styles.notice}><Text style={styles.noticeText}>{loadError}</Text><AppButton title="Try again" secondary onPress={load} /></View>}
    {purchaseService.available && products === null && <ActivityIndicator color={theme.colors.cyan} style={{ marginVertical: 20 }} />}

    {visible.map(item => {
      const product = products?.find(p => p.id === item.id);
      const has = ownsItem(item.id);
      const unavailable = purchaseService.available && products !== null && !product && !has;
      return <View key={item.id} style={[styles.item, item.best && styles.best]}>
        {item.best && <Text style={styles.bestTag}>BEST VALUE</Text>}
        <View style={styles.itemRow}>
          <Preview kind={item.preview} />
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemDetail}>{item.detail}</Text>
          </View>
          {product && !has && <Text style={styles.price}>{product.price}</Text>}
        </View>
        {has ? <Text style={styles.owned}>✓ Owned</Text>
          : <AppButton
              title={busy === item.id ? 'Waiting for the store…' : unavailable ? 'Not available yet' : product ? `Buy for ${product.price}` : 'Buy'}
              disabled={!purchaseService.available || busy !== null || unavailable || !product}
              onPress={() => { void buy(item); }} />}
      </View>;
    })}

    {!!message && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
    <AppButton title={busy === 'restore' ? 'Restoring…' : 'Restore purchases'} secondary disabled={!purchaseService.available || busy !== null} onPress={() => { void restore(); }} />
    <Text style={styles.footnote}>Bought on another phone, or reinstalled? Restore purchases while signed in to the same App Store or Google Play account. Payment is handled by the store.</Text>
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30 },
  eyebrow: { color: theme.colors.cyan, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, marginTop: 4 },
  title: { color: theme.colors.text, fontSize: 32, fontWeight: '900', marginTop: 2 },
  intro: { color: theme.colors.textDim, fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 14 },
  notice: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12, marginBottom: 12, backgroundColor: theme.colors.surface },
  noticeText: { color: theme.colors.textDim, fontSize: 13, lineHeight: 19 },
  item: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.borderSoft, padding: 14, marginBottom: 12 },
  best: { borderWidth: 2, borderColor: theme.colors.accent, backgroundColor: theme.colors.surfaceAlt },
  bestTag: { color: theme.colors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  preview: { width: 64, height: 44, borderRadius: 8, backgroundColor: '#c7b9a1', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  adsIcon: { fontSize: 18 },
  adsText: { color: '#1d1406', fontWeight: '900', fontSize: 12, marginLeft: 2 },
  itemName: { color: theme.colors.text, fontSize: 16, fontWeight: '900' },
  itemDetail: { color: theme.colors.textDim, fontSize: 13, marginTop: 2 },
  price: { color: theme.colors.accent, fontSize: 17, fontWeight: '900' },
  owned: { color: theme.colors.success, fontWeight: '900', fontSize: 15, textAlign: 'center', paddingVertical: 12 },
  message: { color: theme.colors.text, textAlign: 'center', marginVertical: 8, lineHeight: 20 },
  footnote: { color: theme.colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 },
});
