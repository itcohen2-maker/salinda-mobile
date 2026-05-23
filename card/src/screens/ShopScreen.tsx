import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Platform, ActivityIndicator, ScrollView, ImageBackground, Image,
  useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SlindaCoin } from '../../components/SlindaCoin';
import { SpinningCard } from '../components/SpinningCard';
import { ThemePreview } from '../components/ThemePreview';
import { THEMES, THEME_IDS, type ThemeId } from '../theme/themes';
import { TABLE_SKINS, TABLE_SKIN_IDS, type TableSkinId } from '../theme/tableSkins';
import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../i18n/LocaleContext';
import { useActiveTheme } from '../theme/ThemeContext';
import { useWebViewportSize } from '../hooks/useWebViewportSize';
import { getWebContentWidth } from '../theme/webLayout';
import { activateTableSkin } from '../theme/activateTableSkin';
import { getScreenSafeTop } from '../theme/screenInsets';
import { SALINDA_CATALOG } from '../../shared/salindaEconomy';

const SALINDA_IMAGE = require('../../assets/salinda-transparent.png');
const CLASSIC_TABLE_IMAGE = require('../../assets/table_green_default.png');
const SLINDA_PRICE = SALINDA_CATALOG.salinda_card.price;
const WILD_PRICE = SALINDA_CATALOG.wild_card.price;

type FeedbackTone = 'success' | 'error';

type Props = {
  visible: boolean;
  onClose: () => void;
};

function isThemeId(value: string | null | undefined): value is ThemeId {
  return !!value && THEME_IDS.includes(value as ThemeId);
}

function isTableSkinId(value: string | null | undefined): value is TableSkinId {
  return !!value && TABLE_SKIN_IDS.includes(value as TableSkinId);
}

function WildPreviewFace({ width }: { width: number }) {
  const height = Math.round(width * (3.5 / 2.5));
  return (
    <View style={{ width, height, borderRadius: 14, overflow: 'hidden' }}>
      <LinearGradient
        colors={['#7C3AED', '#5B21B6', '#4C1D95', '#6D28D9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, padding: 3 }}
      >
        <View style={styles.wildPreviewInner}>
          <LinearGradient
            colors={['#EDE9FE', '#DDD6FE', '#C4B5FD']}
            locations={[0, 0.5, 1]}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.wildPreviewGlow} />
          <View style={styles.wildPreviewCenter}>
            <Text style={styles.wildPreviewStar}>★</Text>
            <Text style={styles.wildPreviewRange}>0-25</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

export function ShopScreen({ visible, onClose }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { profile, purchaseSlinda, purchaseWild, purchaseTheme, purchaseTableSkin, setActiveSkin } = useAuth();
  const { background } = useActiveTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const viewport = useWebViewportSize();
  const viewportWidth = Platform.OS === 'web' ? viewport.width : width;
  const contentWidth = Platform.OS === 'web'
    ? getWebContentWidth(viewportWidth, { maxWidth: 1120, sidePadding: 40 })
    : width;
  const safeTop = getScreenSafeTop(insets.top);
  const headerTopPadding = Platform.OS === 'ios' ? 16 : 16;
  const shouldRightAlignTitle = isRTL && (Platform.OS === 'android' || Platform.OS === 'ios');
  const shouldRightAlignAll = isRTL && Platform.OS === 'ios';
  const [slindaLoading, setSlindaLoading] = useState(false);
  const [wildLoading, setWildLoading] = useState(false);
  const [themeLoading, setThemeLoading] = useState<ThemeId | null>(null);
  const [tableSkinLoading, setTableSkinLoading] = useState<TableSkinId | null>(null);
  const [activationLoading, setActivationLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone | null>(null);
  const [previewTheme, setPreviewTheme] = useState<ThemeId | null>(null);
  const [previewTableSkin, setPreviewTableSkin] = useState<TableSkinId | 'none' | null>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  const slindaOwned = profile?.slinda_owned ?? false;
  const wildOwned = profile?.wild_owned ?? false;
  const rawOwnedThemes = profile?.themes_owned ?? ['classic'];
  const ownedThemes = THEME_IDS.filter((themeId) => themeId === 'classic' || rawOwnedThemes.includes(themeId));
  const rawOwnedTableSkins = profile?.table_skins_owned ?? [];
  const ownedTableSkins = TABLE_SKIN_IDS.filter((skinId) => rawOwnedTableSkins.includes(skinId));
  const coins = profile?.total_coins ?? 0;
  const coinCountText = `${Math.max(0, Math.floor(Number(coins) || 0))}`;
  const hasLongCoinCount = coinCountText.length >= 5;
  const coinCountFontSize = hasLongCoinCount
    ? viewportWidth < 390
      ? 18
      : 20
    : 24;
  const coinCountLineHeight = hasLongCoinCount
    ? viewportWidth < 390
      ? 20
      : 22
    : 26;
  const activeBackgroundThemeId = isThemeId(profile?.active_card_back) ? profile.active_card_back : 'classic';
  const activeTableThemeId = isThemeId(profile?.active_table_theme) ? profile.active_table_theme : 'classic';
  const activeTableSkinId = isTableSkinId(profile?.active_table_skin) ? profile.active_table_skin : null;

  const previewData = previewTheme ? THEMES[previewTheme] : null;
  const previewTableSkinData =
    previewTableSkin && previewTableSkin !== 'none'
      ? TABLE_SKINS[previewTableSkin]
      : null;
  const isPreviewOpen = !!previewTheme || !!previewTableSkin;

  function clearFeedback() {
    setFeedback(null);
    setFeedbackTone(null);
  }

  function showSuccess(message: string) {
    setFeedback(message);
    setFeedbackTone('success');
  }

  function showError(message: string) {
    setFeedback(message);
    setFeedbackTone('error');
  }

  function isThemeFullyActive(themeId: ThemeId) {
    return activeBackgroundThemeId === themeId && activeTableThemeId === themeId;
  }

  async function handleBuySlinda() {
    if (slindaOwned || slindaLoading) return;
    if (coins < SLINDA_PRICE) {
      clearFeedback();
      showError(t('shop.insufficientCoins'));
      return;
    }
    setSlindaLoading(true);
    clearFeedback();
    try {
      const result = await purchaseSlinda();
      if (result === 'ok') showSuccess(t('shop.purchaseSuccess'));
      else if (result === 'insufficient_coins') showError(t('shop.insufficientCoins'));
      else if (result !== 'already_owned') showError(t('shop.purchaseError'));
    } finally {
      setSlindaLoading(false);
    }
  }

  async function handleBuyWild() {
    if (wildOwned || wildLoading) return;
    if (coins < WILD_PRICE) {
      clearFeedback();
      showError(t('shop.insufficientCoins'));
      return;
    }
    setWildLoading(true);
    clearFeedback();
    try {
      const result = await purchaseWild();
      if (result === 'ok') showSuccess(t('shop.purchaseSuccess'));
      else if (result === 'insufficient_coins') showError(t('shop.insufficientCoins'));
      else if (result !== 'already_owned') showError(t('shop.purchaseError'));
    } finally {
      setWildLoading(false);
    }
  }

  async function handleBuyTheme(themeId: ThemeId) {
    const theme = THEMES[themeId];
    if (ownedThemes.includes(themeId) || themeLoading) return;
    if (coins < theme.price) {
      clearFeedback();
      showError(t('shop.insufficientCoins'));
      return;
    }
    setThemeLoading(themeId);
    clearFeedback();
    try {
      const result = await purchaseTheme(themeId);
      if (result === 'ok') showSuccess(t('shop.themePurchaseSuccess'));
      else if (result === 'insufficient_coins') showError(t('shop.insufficientCoins'));
      else if (result !== 'already_owned') showError(t('shop.purchaseError'));
    } finally {
      setThemeLoading(null);
    }
  }

  async function handleBuyTableSkin(skinId: TableSkinId) {
    const skin = TABLE_SKINS[skinId];
    if (ownedTableSkins.includes(skinId) || tableSkinLoading) return;
    if (coins < skin.price) {
      clearFeedback();
      showError(t('shop.insufficientCoins'));
      return;
    }
    setTableSkinLoading(skinId);
    clearFeedback();
    try {
      const result = await purchaseTableSkin(skinId);
      if (result === 'ok') showSuccess(t('shop.tableSkinPurchaseSuccess'));
      else if (result === 'insufficient_coins') showError(t('shop.insufficientCoins'));
      else if (result !== 'already_owned') showError(t('shop.purchaseError'));
    } finally {
      setTableSkinLoading(null);
    }
  }

  async function handleActivateTheme(themeId: ThemeId) {
    const key = `theme:${themeId}`;
    if (activationLoading === key || isThemeFullyActive(themeId)) return;
    setActivationLoading(key);
    clearFeedback();
    try {
      const backgroundResult = await setActiveSkin('card_back', themeId);
      const tableResult = backgroundResult === 'ok'
        ? await setActiveSkin('table_theme', themeId)
        : backgroundResult;
      if (backgroundResult === 'ok' && tableResult === 'ok') showSuccess(t('shop.activationSuccess'));
      else if (backgroundResult === 'not_owned' || tableResult === 'not_owned') showError(t('shop.notOwnedError'));
      else showError(t('shop.activationError'));
    } finally {
      setActivationLoading(null);
    }
  }

  async function handleActivateTableSkin(skinId: TableSkinId | 'none') {
    const key = `table_skin:${skinId}`;
    if (activationLoading === key) return;
    if (skinId !== 'none' && activeTableSkinId === skinId) return;
    setActivationLoading(key);
    clearFeedback();
    try {
      const result = await activateTableSkin(setActiveSkin, skinId);
      if (result === 'ok') {
        showSuccess(skinId === 'none' ? t('shop.tableSkinRemovedSuccess') : t('shop.activationSuccess'));
      } else if (result === 'not_owned') {
        showError(t('shop.notOwnedError'));
      } else {
        showError(t('shop.activationError'));
      }
    } finally {
      setActivationLoading(null);
    }
  }
  function renderSpecialCard({
    kind,
    name,
    description,
    price,
    owned,
    loading,
    onBuy,
  }: {
    kind: 'slinda' | 'wild';
    name: string;
    description: string;
    price: number;
    owned: boolean;
    loading: boolean;
    onBuy: () => void;
  }) {
    const canAfford = coins >= price;
    const btnDisabled = owned || loading;
    const btnStyle = owned ? styles.btnOwned : !canAfford ? styles.btnLocked : styles.btnBuy;
    const preview = kind === 'slinda'
      ? (
          <SpinningCard
            frontSource={SALINDA_IMAGE}
            width={104}
            speed={28}
            backLabel={name}
            active={visible}
          />
        )
      : (
          <SpinningCard
            width={104}
            speed={28}
            backLabel={name}
            active={visible}
            front={<WildPreviewFace width={104} />}
          />
        );

    return (
      <View style={styles.specialCard}>
        <LinearGradient
          colors={['rgba(252,211,77,0.08)', 'rgba(252,211,77,0.03)', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.specialCardInner}>
          <View style={styles.cardCol}>
            {preview}
          </View>
          <View style={styles.infoCol}>
            <View style={styles.infoTop}>
              <View style={[styles.itemBadge, shouldRightAlignAll ? styles.itemBadgeRtl : null]}>
                <Text style={[styles.itemBadgeText, shouldRightAlignAll ? styles.rtlText : null]}>
                  {t('shop.specialCardBadge')}
                </Text>
              </View>
              <Text style={[styles.cardName, shouldRightAlignAll ? styles.rtlTextFull : null]}>
                {name}
              </Text>
              <Text style={[styles.cardType, shouldRightAlignAll ? styles.rtlTextFull : null]}>
                {description}
              </Text>
            </View>
            <View style={styles.specialCardBottom}>
              <View style={styles.infoSep} />
              <View style={[styles.priceRow, shouldRightAlignAll ? styles.priceRowRtl : null]}>
                <SlindaCoin size={16} />
                <Text style={styles.priceValue}>{price}</Text>
                <Text style={[styles.priceMeta, shouldRightAlignAll ? styles.rtlText : null]}>
                  {t('shop.coinsUnit')}
                </Text>
              </View>
              {!owned && !canAfford && (
                <Text style={[styles.shortfall, shouldRightAlignAll ? styles.rtlTextFull : null]}>
                  {t('shop.shortfall', { count: price - coins })}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.btn, btnStyle]}
                onPress={onBuy}
                disabled={btnDisabled}
                activeOpacity={0.8}
                testID={`shop-${kind}-buy`}
              >
                {loading
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={styles.btnText}>
                      {owned ? t('shop.ownedButton') : !canAfford ? `🔒 ${t('shop.buyButton')}` : t('shop.buyButton')}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  function handleClose() {
    if (previewTheme) { setPreviewTheme(null); return; }
    if (previewTableSkin) { setPreviewTableSkin(null); return; }
    onClose();
  }

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
    setScrolledToBottom(isNearBottom);
  }

  function renderStatusPill(label: string) {
    return (
      <View key={label} style={styles.statusPill}>
        <Text style={[styles.statusPillText, shouldRightAlignAll ? styles.rtlText : null]}>{label}</Text>
      </View>
    );
  }

  function renderThemeAction(themeId: ThemeId, previewMode: boolean) {
    const active = isThemeFullyActive(themeId);
    const busy = activationLoading === `theme:${themeId}`;
    const containerStyle = previewMode ? styles.previewActionBtn : styles.productBtn;
    const textStyle = [
      previewMode ? styles.previewActionBtnText : styles.productBtnText,
      shouldRightAlignAll ? styles.rtlTextFull : null,
    ];
    return (
      <TouchableOpacity
        style={[containerStyle, active ? styles.productBtnActive : styles.productBtnSelect]}
        onPress={() => void handleActivateTheme(themeId)}
        disabled={active || busy}
        activeOpacity={0.8}
      >
        {busy
          ? <ActivityIndicator color="#FFF" size="small" />
          : <Text style={textStyle}>{active ? t('shop.activeBadge') : t('shop.activateButton')}</Text>
        }
      </TouchableOpacity>
    );
  }

  function renderNoTableSkinAction(previewMode: boolean) {
    const active = !activeTableSkinId;
    const busy = activationLoading === 'table_skin:none';
    const containerStyle = previewMode ? styles.previewActionBtn : styles.productBtn;
    const textStyle = [
      previewMode ? styles.previewActionBtnText : styles.productBtnText,
      shouldRightAlignAll ? styles.rtlTextFull : null,
    ];

    if (active) {
      return (
        <View style={[containerStyle, styles.productBtnActive]}>
          <Text style={textStyle}>{t('shop.activeBadge')}</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[containerStyle, styles.productBtnSelect]}
        onPress={() => void handleActivateTableSkin('none')}
        disabled={busy}
        activeOpacity={0.8}
      >
        {busy
          ? <ActivityIndicator color="#FFF" size="small" />
          : <Text style={textStyle}>{t('shop.removeTableSkinButton')}</Text>
        }
      </TouchableOpacity>
    );
  }

  function renderThemeActions(themeId: ThemeId, previewMode: boolean) {
    const theme = THEMES[themeId];
    const owned = ownedThemes.includes(themeId);
    const busy = themeLoading === themeId;
    const canAfford = coins >= theme.price;
    if (!owned) {
      return (
        <TouchableOpacity
          style={[
            previewMode ? styles.previewActionBtn : styles.productBtn,
            !canAfford ? styles.productBtnLocked : styles.productBtnBuy,
          ]}
          onPress={() => void handleBuyTheme(themeId)}
          disabled={busy}
          activeOpacity={0.8}
          testID={`shop-theme-buy-${themeId}`}
        >
          {busy
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Text style={[
                previewMode ? styles.previewActionBtnText : styles.productBtnText,
                shouldRightAlignAll ? styles.rtlTextFull : null,
              ]}>
                {!canAfford ? `🔒 ${t('shop.buyButton')}` : t('shop.buyButton')}
              </Text>
          }
        </TouchableOpacity>
      );
    }

    return renderThemeAction(themeId, previewMode);
  }

  function renderTableSkinAction(skinId: TableSkinId, previewMode: boolean) {
    const owned = ownedTableSkins.includes(skinId);
    const active = activeTableSkinId === skinId;
    const busy = tableSkinLoading === skinId || activationLoading === `table_skin:${skinId}`;
    const skin = TABLE_SKINS[skinId];
    const canAfford = coins >= skin.price;
    const containerStyle = previewMode ? styles.previewActionBtn : styles.productBtn;
    const textStyle = [
      previewMode ? styles.previewActionBtnText : styles.productBtnText,
      shouldRightAlignAll ? styles.rtlTextFull : null,
    ];

    if (owned) {
      return (
        <TouchableOpacity
          style={[containerStyle, active ? styles.productBtnActive : styles.productBtnSelect]}
          onPress={() => void handleActivateTableSkin(skinId)}
          disabled={active || busy}
          activeOpacity={0.8}
        >
          {busy
          ? <ActivityIndicator color="#FFF" size="small" />
          : <Text style={textStyle}>{active ? t('shop.activeBadge') : t('shop.activateButton')}</Text>
          }
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[containerStyle, !canAfford ? styles.productBtnLocked : styles.productBtnBuy]}
        onPress={() => void handleBuyTableSkin(skinId)}
        disabled={busy}
        activeOpacity={0.8}
        testID={`shop-table-skin-buy-${skinId}`}
      >
        {busy
          ? <ActivityIndicator color="#FFF" size="small" />
          : <Text style={textStyle}>{!canAfford ? `🔒 ${t('shop.buyButton')}` : t('shop.buyButton')}</Text>
        }
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { width, height }, isPreviewOpen ? styles.containerHidden : null]}>
          <LinearGradient
            colors={['#0a0f1e', '#0d1f35', '#0a1628']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.3, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <LinearGradient
            colors={['transparent', GOLD, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.topShimmer, { marginTop: safeTop }]}
          />

          <View style={[styles.contentFrame, { width: contentWidth }]}>
            <View style={[styles.header, { paddingTop: headerTopPadding }]}>
              <View style={[styles.coinBadge, isRTL ? styles.coinBadgeRtl : null]}>
                <View style={[styles.coinBadgeTextWrap, isRTL ? styles.coinBadgeTextWrapRtl : null]}>
                  <Text style={[styles.coinBadgeLabel, isRTL ? styles.coinBadgeLabelRtl : null]}>
                    {t('shop.earnedSoFar')}
                  </Text>
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    numberOfLines={1}
                    style={[
                      styles.coinCount,
                      isRTL ? styles.coinCountRtl : null,
                      { fontSize: coinCountFontSize, lineHeight: coinCountLineHeight },
                    ]}
                  >
                    {coinCountText}
                  </Text>
                </View>
                <View style={styles.coinHeroWrap}>
                  <View style={styles.coinHeroGlow} />
                  <SlindaCoin size={52} spin />
                </View>
              </View>
              <View style={[styles.titleWrap, shouldRightAlignTitle ? styles.titleWrapRtl : null]}>
                <Text style={[styles.titleSmall, shouldRightAlignTitle ? styles.rtlTextFull : null]}>
                  {t('shop.title')}
                </Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.closeX}>X</Text>
              </TouchableOpacity>
            </View>

            <LinearGradient
              colors={['transparent', 'rgba(252,211,77,0.35)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.dividerGradient}
            />

            <ScrollView
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              contentContainerStyle={styles.scrollBody}
            >
            <View style={styles.specialProductsWrap}>
              {renderSpecialCard({
                kind: 'slinda',
                name: t('shop.slindaCard.name'),
                description: t('shop.slindaCard.description'),
                price: SLINDA_PRICE,
                owned: slindaOwned,
                loading: slindaLoading,
                onBuy: handleBuySlinda,
              })}
              {renderSpecialCard({
                kind: 'wild',
                name: t('shop.wildCard.name'),
                description: t('shop.wildCard.description'),
                price: WILD_PRICE,
                owned: wildOwned,
                loading: wildLoading,
                onBuy: handleBuyWild,
              })}
            </View>

            <SectionHeader title={t('shop.themesSection')} rightAligned={shouldRightAlignAll} />
            <Text style={[styles.subsectionTitle, shouldRightAlignAll ? styles.rtlTextFull : null]}>
              {t('shop.backgroundsTitle')}
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {THEME_IDS.map((themeId) => {
                const theme = THEMES[themeId];
                const owned = ownedThemes.includes(themeId);
                return (
                  <View key={themeId} style={[styles.productCard, styles.themeProductCard, owned && styles.productCardOwned]}>
                    {owned && (
                      <LinearGradient
                        colors={['rgba(252,211,77,0.12)', 'transparent']}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <TouchableOpacity
                      onPress={() => setPreviewTheme(themeId)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.previewThumb}>
                        <ThemePreview themeId={themeId} size="medium" />
                        <View style={styles.previewHint}>
                          <Text style={styles.previewHintText}>{t('shop.previewHint')}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                    <Text style={[styles.productName, shouldRightAlignAll ? styles.rtlTextFull : null]}>
                      {locale === 'he' ? theme.name_he : theme.name_en}
                    </Text>
                    {!owned && theme.price > 0 && (
                      <View style={[styles.productPriceRow, shouldRightAlignAll ? styles.priceRowRtl : null]}>
                        <SlindaCoin size={13} />
                        <Text style={styles.productPriceText}>{theme.price}</Text>
                      </View>
                    )}
                    {renderThemeActions(themeId, false)}
                  </View>
                );
              })}
            </ScrollView>

            <SectionHeader title={t('shop.tablesSection')} rightAligned={shouldRightAlignAll} />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              <View style={[styles.productCard, !activeTableSkinId && styles.productCardOwned]}>
                {!activeTableSkinId && (
                  <LinearGradient
                    colors={['rgba(252,211,77,0.12)', 'transparent']}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <TouchableOpacity onPress={() => setPreviewTableSkin('none')} activeOpacity={0.8}>
                  <View style={styles.tableSkinThumb}>
                    <Image
                      source={CLASSIC_TABLE_IMAGE as any}
                      style={styles.classicTableThumbImg}
                      resizeMode="stretch"
                    />
                    <View style={styles.previewHint}>
                      <Text style={styles.previewHintText}>{t('shop.previewHint')}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                <Text style={[styles.productName, shouldRightAlignAll ? styles.rtlTextFull : null]}>
                  {t('shop.noTableSkinName')}
                </Text>
                {renderNoTableSkinAction(false)}
              </View>
              {TABLE_SKIN_IDS.map((skinId) => {
                const skin = TABLE_SKINS[skinId];
                const owned = ownedTableSkins.includes(skinId);
                return (
                  <View key={skinId} style={[styles.productCard, owned && styles.productCardOwned]}>
                    {owned && (
                      <LinearGradient
                        colors={['rgba(252,211,77,0.12)', 'transparent']}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <TouchableOpacity onPress={() => setPreviewTableSkin(skinId)} activeOpacity={0.8}>
                      <View style={styles.tableSkinThumb}>
                        <Image
                          source={skin.image}
                          resizeMode="contain"
                          style={styles.tableSkinThumbImg}
                        />
                        <View style={styles.previewHint}>
                          <Text style={styles.previewHintText}>{t('shop.previewHint')}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                    <Text style={[styles.productName, shouldRightAlignAll ? styles.rtlTextFull : null]}>
                      {locale === 'he' ? skin.name_he : skin.name_en}
                    </Text>
                    {!owned && (
                      <View style={[styles.productPriceRow, shouldRightAlignAll ? styles.priceRowRtl : null]}>
                        <SlindaCoin size={13} />
                        <Text style={styles.productPriceText}>{skin.price}</Text>
                      </View>
                    )}
                    {renderTableSkinAction(skinId, false)}
                  </View>
                );
              })}
            </ScrollView>

            {!!feedback && (
              <View style={[styles.feedbackWrap, shouldRightAlignAll ? styles.feedbackWrapRtl : null]}>
                <Text style={[
                  styles.feedbackText,
                  feedbackTone === 'success' ? styles.feedbackSuccess : null,
                  shouldRightAlignAll ? styles.rtlTextFull : null,
                ]}>
                  {feedback}
                </Text>
              </View>
            )}

              <View style={{ height: 40 }} />
            </ScrollView>

            {!scrolledToBottom && (
              <LinearGradient
                colors={['transparent', 'rgba(10,15,30,0.92)']}
                style={styles.bottomFade}
                pointerEvents="none"
              >
                <Text style={styles.scrollHintText}>v</Text>
              </LinearGradient>
            )}
          </View>
        </View>

        {previewTheme && previewData && (
          <View style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="auto">
            {previewData.background.image ? (
              <ImageBackground source={previewData.background.image} resizeMode="cover" style={StyleSheet.absoluteFill} />
            ) : (
              <LinearGradient colors={previewData.background.gradient} style={StyleSheet.absoluteFill} />
            )}
            {previewTheme !== 'classic' && previewData.table.image ? (
              <ImageBackground
                source={previewData.table.image}
                resizeMode="cover"
                style={[StyleSheet.absoluteFill, { opacity: 0.85 }]}
              />
            ) : previewData.table.gradient ? (
              <LinearGradient colors={previewData.table.gradient} style={[StyleSheet.absoluteFill, { opacity: 0.75 }]} />
            ) : null}

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.85)']}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 320 }}
            />

            <TouchableOpacity style={[styles.previewClose, { top: safeTop + 8 }]} onPress={() => setPreviewTheme(null)}>
              <Text style={styles.previewCloseText}>X</Text>
            </TouchableOpacity>

            <View style={[styles.previewBar, shouldRightAlignAll ? styles.previewBarRtl : null]}>
              <Text style={[styles.previewThemeName, shouldRightAlignAll ? styles.rtlTextFull : null]}>
                {locale === 'he' ? previewData.name_he : previewData.name_en}
              </Text>
              {!ownedThemes.includes(previewTheme) && (
                <View style={[styles.previewPriceRow, shouldRightAlignAll ? styles.priceRowRtl : null]}>
                  <SlindaCoin size={18} />
                  <Text style={[styles.previewPriceText, shouldRightAlignAll ? styles.rtlText : null]}>
                    {previewData.price} {t('shop.coinsUnit')}
                  </Text>
                </View>
              )}
              {renderThemeActions(previewTheme, true)}
            </View>
          </View>
        )}

        {previewTableSkin && (
          <View style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="auto">
            {background.image ? (
              <ImageBackground source={background.image} resizeMode="cover" style={StyleSheet.absoluteFill} />
            ) : (
              <LinearGradient
                colors={[...background.gradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.85, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            {previewTableSkin === 'none' ? (
              <View pointerEvents="none" style={styles.classicPreviewStage}>
                <Image source={CLASSIC_TABLE_IMAGE} resizeMode="stretch" style={styles.classicPreviewStageImage} />
              </View>
            ) : (
              <Image
                source={previewTableSkinData?.image as any}
                resizeMode="contain"
                style={{ position: 'absolute', width: '100%', height: '100%' }}
              />
            )}

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.85)']}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 280 }}
            />

            <TouchableOpacity style={[styles.previewClose, { top: safeTop + 8 }]} onPress={() => setPreviewTableSkin(null)}>
              <Text style={styles.previewCloseText}>X</Text>
            </TouchableOpacity>

            <View style={[styles.previewBar, shouldRightAlignAll ? styles.previewBarRtl : null]}>
              <Text style={[styles.previewThemeName, shouldRightAlignAll ? styles.rtlTextFull : null]}>
                {previewTableSkin === 'none'
                  ? t('shop.noTableSkinName')
                  : locale === 'he'
                    ? previewTableSkinData?.name_he
                    : previewTableSkinData?.name_en}
              </Text>
              {previewTableSkin !== 'none' && previewTableSkinData && !ownedTableSkins.includes(previewTableSkin) && (
                <View style={[styles.previewPriceRow, shouldRightAlignAll ? styles.priceRowRtl : null]}>
                  <SlindaCoin size={18} />
                  <Text style={[styles.previewPriceText, shouldRightAlignAll ? styles.rtlText : null]}>
                    {previewTableSkinData.price} {t('shop.coinsUnit')}
                  </Text>
                </View>
              )}
              {previewTableSkin !== 'none' && ownedTableSkins.includes(previewTableSkin) && activeTableSkinId === previewTableSkin && (
                <View style={[styles.statusPillsRow, shouldRightAlignAll ? styles.statusPillsRowRtl : null]}>
                  {renderStatusPill(t('shop.activeBadge'))}
                </View>
              )}
              {previewTableSkin === 'none'
                ? renderNoTableSkinAction(true)
                : previewTableSkinData
                  ? renderTableSkinAction(previewTableSkin, true)
                  : null}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

function SectionHeader({ title, rightAligned = false }: { title: string; rightAligned?: boolean }) {
  return (
    <View style={[sectionHeaderStyles.wrap, rightAligned ? sectionHeaderStyles.wrapRtl : null]}>
      <LinearGradient
        colors={['transparent', 'rgba(252,211,77,0.5)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={sectionHeaderStyles.line}
      />
      <Text style={[sectionHeaderStyles.text, rightAligned ? sectionHeaderStyles.textRtl : null]}>{title}</Text>
      <LinearGradient
        colors={['transparent', 'rgba(252,211,77,0.5)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={sectionHeaderStyles.line}
      />
    </View>
  );
}

const sectionHeaderStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 10, marginTop: 28, marginBottom: 14 },
  wrapRtl: { flexDirection: 'row-reverse' },
  line: { flex: 1, height: 1 },
  text: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  textRtl: { textAlign: 'right', writingDirection: 'rtl' },
});

const GOLD = '#FCD34D';
const GOLD_LIGHT = '#FDE68A';
const GOLD_DIM = 'rgba(252,211,77,0.6)';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.0)',
  },
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: 'inset 0 0 120px rgba(252,211,77,0.04)' } as any
      : {}),
  },
  containerHidden: { opacity: 0 },
  contentFrame: {
    flex: 1,
    maxWidth: '100%',
  },

  topShimmer: {
    height: 1,
    width: '100%',
    marginTop: Platform.OS === 'ios' ? 44 : 0,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 16 : 52,
    paddingBottom: 16,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: 'rgba(252,211,77,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.25)',
    borderRadius: 26,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    minWidth: 172,
    maxWidth: '62%',
    flexShrink: 1,
  },
  coinBadgeRtl: {
    flexDirection: 'row-reverse',
  },
  coinBadgeTextWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 2,
  },
  coinBadgeTextWrapRtl: {
    alignItems: 'flex-end',
  },
  coinBadgeLabel: {
    color: 'rgba(254,243,199,0.9)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  coinBadgeLabelRtl: {
    textAlign: 'right',
  },
  coinHeroWrap: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinHeroGlow: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 28px 10px rgba(252,211,77,0.22)' }
      : { shadowColor: '#FCD34D', shadowOpacity: 0.34, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 7 }),
  },
  coinCount: { color: GOLD_LIGHT, fontSize: 24, fontWeight: '900', lineHeight: 26, width: '100%', flexShrink: 1 },
  coinCountRtl: { textAlign: 'right' },
  titleWrap: { flex: 1, alignItems: 'center' },
  titleWrapRtl: { alignItems: 'flex-end' },
  titleSmall: { color: GOLD, fontSize: 16, fontWeight: '900', letterSpacing: 3 },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 48,
    alignItems: 'center',
  },
  closeX: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '700' },

  dividerGradient: { height: 1, width: '100%', marginBottom: 4 },
  scrollBody: { paddingBottom: 10 },

  specialProductsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  specialCard: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 300,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.2)',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 32px rgba(252,211,77,0.08)' } as any
      : { shadowColor: GOLD, shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 4 }, elevation: 8 }),
  },
  specialCardInner: { flexDirection: 'row', alignItems: 'stretch', padding: 20, gap: 16, minHeight: 236 },
  cardCol: { alignItems: 'center', justifyContent: 'center' },
  infoCol: { flex: 1, paddingTop: 2, justifyContent: 'space-between' },
  infoTop: { gap: 6 },
  specialCardBottom: { gap: 6 },
  itemBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(252,211,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 2,
  },
  itemBadgeText: { color: GOLD_DIM, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  cardName: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 0.3 },
  cardType: { color: 'rgba(253,230,138,0.7)', fontSize: 12, fontWeight: '500', fontStyle: 'italic' },
  infoSep: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  priceRowRtl: { alignSelf: 'flex-end' },
  priceValue: { color: GOLD, fontSize: 16, fontWeight: '900' },
  priceMeta: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '500' },
  shortfall: { color: '#F87171', fontSize: 11, fontWeight: '700' },
  btn: { borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 4 },
  btnBuy: { backgroundColor: '#15803D' },
  btnOwned: { backgroundColor: 'rgba(255,255,255,0.08)' },
  btnLocked: { backgroundColor: 'rgba(255,255,255,0.06)', opacity: 0.7 },
  btnText: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.3, textAlign: 'center' },
  itemBadgeRtl: { alignSelf: 'flex-end' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  rtlTextFull: { width: '100%', textAlign: 'right', writingDirection: 'rtl' },
  wildPreviewInner: { flex: 1, borderRadius: 11, overflow: 'hidden' },
  wildPreviewGlow: {
    position: 'absolute',
    top: '-12%',
    left: '10%',
    width: '80%',
    height: '40%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  wildPreviewCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wildPreviewStar: { color: '#5B21B6', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  wildPreviewRange: { color: '#6D28D9', fontSize: 12, fontWeight: '800', marginTop: 2, textAlign: 'center' },

  horizontalList: { paddingHorizontal: 16, paddingBottom: 4, gap: 10 },
  subsectionTitle: {
    color: GOLD_LIGHT,
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 16,
    marginTop: -4,
    marginBottom: 10,
  },
  productCard: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
    minWidth: 120,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  themeProductCard: {
    minWidth: 150,
  },
  productCardOwned: {
    borderColor: 'rgba(252,211,77,0.35)',
  },
  previewThumb: { position: 'relative' },
  previewHint: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  previewHintText: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '700' },
  productName: { color: '#E2E8F0', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  productPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  productPriceText: { color: GOLD, fontWeight: '800', fontSize: 12 },
  productBtn: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', width: '100%' },
  productBtnBuy: { backgroundColor: '#15803D' },
  productBtnLocked: { backgroundColor: 'rgba(255,255,255,0.06)', opacity: 0.65 },
  productBtnSelect: { backgroundColor: '#0369A1' },
  productBtnActive: { backgroundColor: '#15803D', borderWidth: 1, borderColor: '#4ADE80' },
  productBtnText: { color: '#FFF', fontSize: 10.5, fontWeight: '800', textAlign: 'center' },
  statusPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    minHeight: 24,
  },
  statusPill: {
    backgroundColor: 'rgba(252,211,77,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.28)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillText: { color: GOLD_LIGHT, fontSize: 10, fontWeight: '800' },

  tableSkinThumb: {
    width: 120,
    height: 46,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  tableSkinThumbImg: { width: 120, height: 46 },
  classicTableThumbImg: { width: 120, height: 46 },
  noneSkinThumb: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  classicPreviewStage: {
    position: 'absolute',
    left: '6%',
    right: '6%',
    top: '20%',
    height: '42%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  classicPreviewStageImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },

  feedbackWrap: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, alignItems: 'center' },
  feedbackWrapRtl: { alignItems: 'flex-end' },
  feedbackText: { color: '#F87171', fontSize: 13, textAlign: 'center', fontWeight: '600' },
  feedbackSuccess: { color: '#4ADE80' },

  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  scrollHintText: {
    color: 'rgba(252,211,77,0.5)',
    fontSize: 18,
    fontWeight: '700',
  },

  previewClose: {
    position: 'absolute', top: 52, right: 20,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  previewCloseText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  previewBar: {
    position: 'absolute', bottom: 60, left: 24, right: 24, alignItems: 'center', gap: 12,
  },
  previewBarRtl: { alignItems: 'flex-end' },
  previewThemeName: {
    color: '#FFF', fontSize: 30, fontWeight: '900', letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10,
    textAlign: 'center',
  },
  previewPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewPriceText: { color: GOLD, fontSize: 18, fontWeight: '800' },
  previewActionBtn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', width: '100%' },
  previewActionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.4, textAlign: 'center' },
  statusPillsRowRtl: { justifyContent: 'flex-end' },
});
