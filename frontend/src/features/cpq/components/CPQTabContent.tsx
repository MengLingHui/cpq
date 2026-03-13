import type { ReactNode } from 'react';
import Configurator from '@/components/Configurator';
import EngineerModelList from '@/components/EngineerModelList';
import MarketModelManager from '@/components/MarketModelManager';
import PriceTableManager from '@/components/PriceTableManager';
import SavedConfigList from '@/components/SavedConfigList';
import ConfigNumberQuery from '@/components/ConfigNumberQuery';
import TestToolsPanel from '@/components/TestToolsPanel';
import CRMOpportunityPage from '@/pages/CRMOpportunity';
import type { CPQTab } from '@/features/cpq/menu-items';

interface CPQTabContentProps {
  activeTab: string;
}

const CARD_WRAPPER_CLASS = 'bg-white rounded-lg border shadow-sm p-4';

function wrapInCard(content: ReactNode) {
  return <div className={CARD_WRAPPER_CLASS}>{content}</div>;
}

const TAB_CONTENT: Record<CPQTab, React.ReactNode> = {
  configurator: <Configurator />,
  'crm-demo': <CRMOpportunityPage embedded />,
  saved: wrapInCard(<SavedConfigList />),
  query: wrapInCard(<ConfigNumberQuery />),
  market: wrapInCard(<MarketModelManager />),
  engineer: wrapInCard(<EngineerModelList />),
  pricetable: wrapInCard(<PriceTableManager />),
  // 'pure-quote': wrapInCard(<PureProductQuoteSheet />),
  test: wrapInCard(<TestToolsPanel />),
};

export default function CPQTabContent({ activeTab }: CPQTabContentProps) {
  const content = TAB_CONTENT[activeTab as CPQTab] ?? TAB_CONTENT.configurator;

  return <>{content}</>;
}
