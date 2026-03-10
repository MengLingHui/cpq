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
import { Plus, Eye, Database } from 'lucide-react';
import type { EngineerModel } from '@/lib/cpq-data';

function EngineerModelDetail({ model }: { model: EngineerModel }) {
  return (
    <div className="max-h-[60vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-2 text-xs mb-3 p-2 bg-slate-50 rounded">
        <div><span className="text-slate-500">机型ID:</span> {model.model_id}</div>
        <div><span className="text-slate-500">系列:</span> {model.series_info.series_name} - {model.series_info.series_description}</div>
      </div>
      <Accordion type="multiple" className="w-full">
        {model.configuration_groups.map((group) => (
          <AccordionItem key={group.super_category_id} value={`group-${group.super_category_id}`}>
            <AccordionTrigger className="text-xs font-medium py-2">
              <div className="flex items-center gap-2">
                {group.super_category_name}
                <Badge variant="secondary" className="text-[10px] h-4">
                  {group.categories.length} 项
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <Table>
                <TableHeader>
                  <TableRow className="text-[10px]">
                    <TableHead className="h-7 text-[10px]">编码</TableHead>
                    <TableHead className="h-7 text-[10px]">名称</TableHead>
                    <TableHead className="h-7 text-[10px]">选项数</TableHead>
                    <TableHead className="h-7 text-[10px]">默认值</TableHead>
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
  const { engineerModels, createMarketModelFromEngineer } = useCPQStore();

  if (engineerModels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Database className="w-12 h-12 mb-3" />
        <p className="text-sm">暂无工程机型数据</p>
        <p className="text-xs mt-1">等待PLM系统同步...</p>
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
          <h2 className="text-sm font-semibold text-slate-800">工程机型列表</h2>
          <p className="text-xs text-slate-500 mt-0.5">从PLM系统同步的工程机型数据，可基于此创建销售机型</p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          共 {engineerModels.length} 个机型
        </Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 text-xs">机型ID</TableHead>
            <TableHead className="h-8 text-xs">机型名称</TableHead>
            <TableHead className="h-8 text-xs">产品系列</TableHead>
            <TableHead className="h-8 text-xs">系列描述</TableHead>
            <TableHead className="h-8 text-xs">配置组</TableHead>
            <TableHead className="h-8 text-xs">配置项</TableHead>
            <TableHead className="h-8 text-xs text-right">操作</TableHead>
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
                          查看
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="text-sm">
                            工程机型详情 - {model.model_name}
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
                      发布销售机型
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