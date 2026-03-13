import { useCPQStore } from '@/lib/cpq-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useI18n } from '@/lib/i18n';
import { Plus, Eye, Database } from 'lucide-react';
import type { EngineerModel } from '@/lib/cpq-data';

function EngineerModelDetail({ model }: { model: EngineerModel }) {
  const { locale } = useI18n();
  const isZh = locale === 'zh-CN';

  return (
    <div className="max-h-[60vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-2 text-xs mb-3 p-2 bg-slate-50 rounded">
        <div><span className="text-slate-500">{isZh ? '机型ID' : 'Model ID'}:</span> {model.model_id}</div>
        <div><span className="text-slate-500">{isZh ? '系列' : 'Series'}:</span> {model.series_info.series_name} - {model.series_info.series_description}</div>
      </div>
      <Accordion type="multiple" className="w-full">
        {model.configuration_groups.map((group) => (
          <AccordionItem key={group.super_category_id} value={`group-${group.super_category_id}`}>
            <AccordionTrigger className="text-xs font-medium py-2">
              <div className="flex items-center gap-2">
                {group.super_category_name}
                <Badge variant="secondary" className="text-[10px] h-4">
                  {group.categories.length} {isZh ? '项' : 'items'}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <Table>
                <TableHeader>
                  <TableRow className="text-[10px]">
                    <TableHead className="h-7 text-[10px]">{isZh ? '编码' : 'Code'}</TableHead>
                    <TableHead className="h-7 text-[10px]">{isZh ? '名称' : 'Name'}</TableHead>
                    <TableHead className="h-7 text-[10px]">{isZh ? '选项数' : 'Options'}</TableHead>
                    <TableHead className="h-7 text-[10px]">{isZh ? '默认值' : 'Default'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.categories.map((cat) => {
                    const defaultOpt = cat.options.find(o => o.is_default);
                    return (
                      <TableRow key={cat.category_id} className="text-[11px]">
                        <TableCell className="py-1 font-mono text-[10px]">{cat.category_code}</TableCell>
                        <TableCell className="py-1">{cat.category_name}</TableCell>
                        <TableCell className="py-1">{cat.options.length}</TableCell>
                        <TableCell className="py-1 text-slate-500 max-w-[200px] truncate">
                          {defaultOpt?.description || '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export default function EngineerModelList() {
  const { locale } = useI18n();
  const isZh = locale === 'zh-CN';
  const { engineerModels, createMarketModelFromEngineer } = useCPQStore();

  if (engineerModels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Database className="w-12 h-12 mb-3" />
        <p className="text-sm">{isZh ? '暂无工程机型数据' : 'No engineer models available'}</p>
        <p className="text-xs mt-1">{isZh ? '等待PLM系统同步...' : 'Waiting for PLM sync...'}</p>
      </div>
    );
  }

  const handleCreateMarketModel = (index: number) => {
    createMarketModelFromEngineer(index);
    // The store will set activeTab to 'market' and editingNewModelIndex
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{isZh ? '工程机型列表' : 'Engineer Models'}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{isZh ? '从PLM系统同步的工程机型数据，可基于此创建销售机型' : 'Engineer models synced from PLM can be used to create market models'}</p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {isZh ? '共' : 'Total'} {engineerModels.length} {isZh ? '个机型' : 'models'}
        </Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 text-xs">{isZh ? '机型ID' : 'Model ID'}</TableHead>
            <TableHead className="h-8 text-xs">{isZh ? '机型名称' : 'Model Name'}</TableHead>
            <TableHead className="h-8 text-xs">{isZh ? '产品系列' : 'Series'}</TableHead>
            <TableHead className="h-8 text-xs">{isZh ? '系列描述' : 'Description'}</TableHead>
            <TableHead className="h-8 text-xs">{isZh ? '配置组' : 'Groups'}</TableHead>
            <TableHead className="h-8 text-xs">{isZh ? '配置项' : 'Categories'}</TableHead>
            <TableHead className="h-8 text-xs text-right">{isZh ? '操作' : 'Actions'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {engineerModels.map((model, index) => {
            const totalCategories = model.configuration_groups.reduce(
              (sum, g) => sum + g.categories.length, 0
            );
            return (
              <TableRow key={model.model_id}>
                <TableCell className="py-2 text-xs font-mono">{model.model_id}</TableCell>
                <TableCell className="py-2 text-xs font-medium">{model.model_name}</TableCell>
                <TableCell className="py-2 text-xs">{model.series_info.series_name}</TableCell>
                <TableCell className="py-2 text-xs text-slate-500">
                  {model.series_info.series_description}
                </TableCell>
                <TableCell className="py-2 text-xs">
                  <Badge variant="secondary" className="text-[10px]">
                    {model.configuration_groups.length}
                  </Badge>
                </TableCell>
                <TableCell className="py-2 text-xs">
                  <Badge variant="secondary" className="text-[10px]">
                    {totalCategories}
                  </Badge>
                </TableCell>
                <TableCell className="py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                          <Eye className="w-3 h-3" />
                          {isZh ? '查看' : 'View'}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="text-sm">
                            {isZh ? '工程机型详情' : 'Engineer Model Details'} - {model.model_name}
                          </DialogTitle>
                        </DialogHeader>
                        <EngineerModelDetail model={model} />
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleCreateMarketModel(index)}
                    >
                      <Plus className="w-3 h-3" />
                      {isZh ? '发布销售机型' : 'Create Market Model'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}