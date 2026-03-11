import { useState, useCallback, useEffect } from 'react';
import { useCPQStore } from '@/lib/cpq-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  GripVertical,
  Pencil,
  Save,
  X,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  ShoppingCart,
  Trash2,
  DollarSign,
  Database,
  Printer,
} from 'lucide-react';
import type { MarketModel, Category, ConfigurationGroup } from '@/lib/cpq-data';

interface MarketModelEditorProps {
  model: MarketModel;
  onUpdate: (model: MarketModel) => void;
  onSave: () => void;
  onCancel: () => void;
}

function MarketModelEditor({ model, onUpdate, onSave, onCancel }: MarketModelEditorProps) {
  const { priceTables, linkPriceTable, editingModelIndex, getEngineerModelName, getPriceTablesForEngineerModel } = useCPQStore();
  const [modelName, setModelName] = useState(model.model_name);
  const [dragOverCatId, setDragOverCatId] = useState<string | null>(null);
  const [draggedCatId, setDraggedCatId] = useState<string | null>(null);

  // Filter price tables to those linked to the same engineer model
  const availablePriceTables = getPriceTablesForEngineerModel(model.engineer_model_id);
  // Use engineer_model_name from JSON if available, otherwise fallback to lookup
  const engineerModelName = model.engineer_model_name || getEngineerModelName(model.engineer_model_id);

  const handleNameChange = useCallback((name: string) => {
    setModelName(name);
    onUpdate({ ...model, model_name: name });
  }, [model, onUpdate]);

  const handlePriceTableChange = useCallback((priceTableId: string) => {
    if (editingModelIndex >= 0) {
      linkPriceTable(editingModelIndex, priceTableId);
    }
    onUpdate({ ...model, price_table_id: priceTableId });
  }, [model, onUpdate, editingModelIndex, linkPriceTable]);

  const toggleCategoryHide = useCallback((groupIdx: number, catIdx: number) => {
    const newModel = JSON.parse(JSON.stringify(model)) as MarketModel;
    newModel.configuration_groups[groupIdx].categories[catIdx].hide =
      !newModel.configuration_groups[groupIdx].categories[catIdx].hide;
    onUpdate(newModel);
  }, [model, onUpdate]);

  const toggleOptionHide = useCallback((groupIdx: number, catIdx: number, optIdx: number) => {
    const newModel = JSON.parse(JSON.stringify(model)) as MarketModel;
    newModel.configuration_groups[groupIdx].categories[catIdx].options[optIdx].hide =
      !newModel.configuration_groups[groupIdx].categories[catIdx].options[optIdx].hide;
    onUpdate(newModel);
  }, [model, onUpdate]);

  const toggleCategoryPrint = useCallback((groupIdx: number, catIdx: number) => {
    const newModel = JSON.parse(JSON.stringify(model)) as MarketModel;
    const category = newModel.configuration_groups[groupIdx].categories[catIdx];
    const current = category.print_enabled !== false;
    category.print_enabled = !current;
    onUpdate(newModel);
  }, [model, onUpdate]);

  const setDefaultOption = useCallback((groupIdx: number, catIdx: number, optIdx: number) => {
    const newModel = JSON.parse(JSON.stringify(model)) as MarketModel;
    const options = newModel.configuration_groups[groupIdx].categories[catIdx].options;
    options.forEach((opt, idx) => {
      opt.is_default = idx === optIdx;
      if (idx === optIdx) {
        opt.hide = false;
      }
    });
    onUpdate(newModel);
  }, [model, onUpdate]);

  const toggleGroupHide = useCallback((groupIdx: number) => {
    const newModel = JSON.parse(JSON.stringify(model)) as MarketModel;
    newModel.configuration_groups[groupIdx].hide = !newModel.configuration_groups[groupIdx].hide;
    onUpdate(newModel);
  }, [model, onUpdate]);

  const moveCategoryInGroup = useCallback((groupIdx: number, catIdx: number, direction: 'up' | 'down') => {
    const newModel = JSON.parse(JSON.stringify(model)) as MarketModel;
    const cats = newModel.configuration_groups[groupIdx].categories;
    const targetIdx = direction === 'up' ? catIdx - 1 : catIdx + 1;
    if (targetIdx < 0 || targetIdx >= cats.length) return;

    const tempSeq = cats[catIdx].seq_id;
    cats[catIdx].seq_id = cats[targetIdx].seq_id;
    cats[targetIdx].seq_id = tempSeq;

    [cats[catIdx], cats[targetIdx]] = [cats[targetIdx], cats[catIdx]];
    onUpdate(newModel);
  }, [model, onUpdate]);

  const moveOptionInCategory = useCallback((groupIdx: number, catIdx: number, optIdx: number, direction: 'up' | 'down') => {
    const newModel = JSON.parse(JSON.stringify(model)) as MarketModel;
    const opts = newModel.configuration_groups[groupIdx].categories[catIdx].options;
    const targetIdx = direction === 'up' ? optIdx - 1 : optIdx + 1;
    if (targetIdx < 0 || targetIdx >= opts.length) return;

    const tempSeq = opts[optIdx].seq_id;
    opts[optIdx].seq_id = opts[targetIdx].seq_id;
    opts[targetIdx].seq_id = tempSeq;

    [opts[optIdx], opts[targetIdx]] = [opts[targetIdx], opts[optIdx]];
    onUpdate(newModel);
  }, [model, onUpdate]);

  const handleCatDragStart = (groupIdx: number, catIdx: number) => {
    setDraggedCatId(`${groupIdx}-${catIdx}`);
  };

  const handleCatDragOver = (e: React.DragEvent, groupIdx: number, catIdx: number) => {
    e.preventDefault();
    setDragOverCatId(`${groupIdx}-${catIdx}`);
  };

  const handleCatDrop = (e: React.DragEvent, groupIdx: number, targetCatIdx: number) => {
    e.preventDefault();
    setDragOverCatId(null);
    if (!draggedCatId) return;

    const [srcGroupIdx, srcCatIdx] = draggedCatId.split('-').map(Number);
    if (srcGroupIdx !== groupIdx || srcCatIdx === targetCatIdx) {
      setDraggedCatId(null);
      return;
    }

    const newModel = JSON.parse(JSON.stringify(model)) as MarketModel;
    const cats = newModel.configuration_groups[groupIdx].categories;
    const [moved] = cats.splice(srcCatIdx, 1);
    cats.splice(targetCatIdx, 0, moved);

    cats.forEach((cat: Category, idx: number) => {
      cat.seq_id = idx + 1;
    });

    onUpdate(newModel);
    setDraggedCatId(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium whitespace-nowrap">名称:</Label>
          <Input
            value={modelName}
            onChange={(e) => handleNameChange(e.target.value)}
            className="h-7 text-xs w-[180px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium whitespace-nowrap flex items-center gap-1">
            <Database className="w-3 h-3" />
            工程机型:
          </Label>
          <Badge variant="outline" className="text-[10px] h-6">
            {engineerModelName}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium whitespace-nowrap flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            默认价格表:
          </Label>
          <Select
            value={model.price_table_id || ''}
            onValueChange={handlePriceTableChange}
          >
            <SelectTrigger className="h-7 text-xs w-[180px]">
              <SelectValue placeholder="选择价格表" />
            </SelectTrigger>
            <SelectContent>
              {availablePriceTables.length === 0 ? (
                <div className="px-2 py-1.5 text-[10px] text-slate-400">
                  无可用价格表（需先为对应工程机型创建价格表）
                </div>
              ) : (
                availablePriceTables.map(pt => (
                  <SelectItem key={pt.id} value={pt.id} className="text-xs">
                    {pt.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1" />
        <Button size="sm" className="h-8 px-3 text-xs gap-1.5 rounded-full shadow-sm" onClick={onSave}>
          <Save className="w-3 h-3" /> 保存
        </Button>
        <Button size="sm" variant="outline" className="h-8 px-3 text-xs gap-1.5 rounded-full border-slate-300 bg-white" onClick={onCancel}>
          <X className="w-3 h-3" /> 取消
        </Button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto space-y-2">
        <Accordion type="multiple" defaultValue={model.configuration_groups.map((_, i) => `eg-${i}`)}>
          {model.configuration_groups.map((group: ConfigurationGroup, groupIdx: number) => (
            <AccordionItem key={group.super_category_id} value={`eg-${groupIdx}`} className="border rounded-lg mb-2">
              <AccordionTrigger className="px-3 py-2 text-xs font-medium hover:no-underline">
                <div className="flex items-center gap-2 flex-1">
                  <span className={group.hide ? 'text-slate-400 line-through' : ''}>
                    {group.super_category_name}
                  </span>
                  <Badge variant={group.hide ? 'outline' : 'secondary'} className="text-[10px] h-4">
                    {group.categories.length} 项
                  </Badge>
                  {group.hide && (
                    <Badge variant="outline" className="text-[10px] h-4 text-amber-600 border-amber-300">
                      已隐藏
                    </Badge>
                  )}
                  <div className="flex-1" />
                  <div className="flex items-center gap-1 mr-2" onClick={(e) => e.stopPropagation()}>
                    <Label className="text-[10px] text-slate-500">显示</Label>
                    <Switch
                      checked={!group.hide}
                      onCheckedChange={() => toggleGroupHide(groupIdx)}
                      className="scale-75"
                    />
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3">
                {/* Always use list mode (table layout) for editing, display_mode is for Configurator only */}
                <Table>
                    <TableHeader>
                      <TableRow className="text-[10px]">
                        <TableHead className="h-6 w-8 text-[10px]"></TableHead>
                        <TableHead className="h-6 text-[10px]">排序</TableHead>
                        <TableHead className="h-6 text-[10px]">名称</TableHead>
                        <TableHead className="h-6 text-[10px]">选项</TableHead>
                        <TableHead className="h-6 text-[10px] text-center">打印</TableHead>
                        <TableHead className="h-6 text-[10px] text-center">显隐</TableHead>
                        <TableHead className="h-6 text-[10px] text-center">排序操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.categories.map((cat: Category, catIdx: number) => (
                        <TableRow
                          key={cat.category_id}
                          className={`text-[11px] ${cat.hide ? 'opacity-40' : ''} ${
                            dragOverCatId === `${groupIdx}-${catIdx}` ? 'bg-blue-50' : ''
                          }`}
                          draggable
                          onDragStart={() => handleCatDragStart(groupIdx, catIdx)}
                          onDragOver={(e) => handleCatDragOver(e, groupIdx, catIdx)}
                          onDrop={(e) => handleCatDrop(e, groupIdx, catIdx)}
                          onDragEnd={() => { setDraggedCatId(null); setDragOverCatId(null); }}
                        >
                          <TableCell className="py-1 w-8 cursor-grab">
                            <GripVertical className="w-3 h-3 text-slate-400" />
                          </TableCell>
                          <TableCell className="py-1 font-mono text-[10px] text-slate-400">
                            {cat.seq_id}
                          </TableCell>
                          <TableCell className="py-1">
                            <div className="flex items-center gap-1.5">
                              <span>{cat.category_name}</span>
                              {cat.print_enabled === false && (
                                <Badge variant="outline" className="text-[9px] h-4 text-amber-700 border-amber-300">
                                  不打印
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-1">
                            <div className="flex flex-wrap gap-0.5">
                              {cat.options.map((opt, optIdx) => (
                                <div key={opt.option_code} className="flex items-center gap-0.5">
                                  <Badge
                                    variant={opt.hide ? 'outline' : opt.is_default ? 'default' : 'secondary'}
                                    className={`text-[9px] h-4 cursor-pointer max-w-[180px] truncate ${opt.hide ? 'line-through text-slate-400' : ''}`}
                                    title={`${opt.description}${opt.is_default ? '（默认）' : ''}`}
                                    onClick={() => setDefaultOption(groupIdx, catIdx, optIdx)}
                                  >
                                    {opt.description}
                                  </Badge>
                                  <button
                                    type="button"
                                    className="text-slate-300 hover:text-slate-600 leading-none"
                                    onClick={() => toggleOptionHide(groupIdx, catIdx, optIdx)}
                                    title={opt.hide ? '显示该选项' : '隐藏该选项'}
                                  >
                                    {opt.hide ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                                  </button>
                                  {optIdx < cat.options.length - 1 && cat.options.length > 1 && (
                                    <div className="flex flex-col">
                                      <button
                                        className="text-slate-300 hover:text-slate-600 leading-none"
                                        onClick={() => moveOptionInCategory(groupIdx, catIdx, optIdx, 'up')}
                                        disabled={optIdx === 0}
                                      >
                                        <ArrowUp className="w-2 h-2" />
                                      </button>
                                      <button
                                        className="text-slate-300 hover:text-slate-600 leading-none"
                                        onClick={() => moveOptionInCategory(groupIdx, catIdx, optIdx, 'down')}
                                        disabled={optIdx === cat.options.length - 1}
                                      >
                                        <ArrowDown className="w-2 h-2" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="py-1 text-center">
                            <div className="inline-flex items-center gap-1">
                              <Printer className={`w-3 h-3 ${cat.print_enabled === false ? 'text-amber-600' : 'text-slate-400'}`} />
                              <Switch
                                checked={cat.print_enabled !== false}
                                onCheckedChange={() => toggleCategoryPrint(groupIdx, catIdx)}
                                className="scale-75"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="py-1 text-center">
                            <Switch
                              checked={!cat.hide}
                              onCheckedChange={() => toggleCategoryHide(groupIdx, catIdx)}
                              className="scale-75"
                            />
                          </TableCell>
                          <TableCell className="py-1 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0"
                                onClick={() => moveCategoryInGroup(groupIdx, catIdx, 'up')}
                                disabled={catIdx === 0}
                              >
                                <ArrowUp className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0"
                                onClick={() => moveCategoryInGroup(groupIdx, catIdx, 'down')}
                                disabled={catIdx === group.categories.length - 1}
                              >
                                <ArrowDown className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}

export default function MarketModelManager() {
  const {
    marketModels,
    editingMarketModel,
    editingNewModelIndex,
    setEditingModel,
    updateEditingModel,
    saveEditingModel,
    cancelEditing,
    deleteMarketModel,
    clearEditingNewModelIndex,
    priceTables,
    getEngineerModelName,
  } = useCPQStore();

  const [dialogOpen, setDialogOpen] = useState(false);

  // Auto-open editor for newly created model
  useEffect(() => {
    if (editingNewModelIndex !== null && editingNewModelIndex >= 0 && editingNewModelIndex < marketModels.length) {
      setEditingModel(editingNewModelIndex);
      setDialogOpen(true);
      clearEditingNewModelIndex();
    }
  }, [editingNewModelIndex, marketModels.length, setEditingModel, clearEditingNewModelIndex]);

  const handleEdit = (index: number) => {
    setEditingModel(index);
    setDialogOpen(true);
  };

  const handleSave = () => {
    saveEditingModel();
    setDialogOpen(false);
  };

  const handleCancel = () => {
    cancelEditing();
    setDialogOpen(false);
  };

  if (marketModels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <ShoppingCart className="w-12 h-12 mb-3" />
        <p className="text-sm">暂无销售机型</p>
        <p className="text-xs mt-1">请先从工程机型创建销售机型</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">销售机型管理</h2>
          <p className="text-xs text-slate-500 mt-0.5">编辑销售机型的配置项顺序和显隐性，关联价格表</p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          共 {marketModels.length} 个机型
        </Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 text-xs">机型ID</TableHead>
            <TableHead className="h-8 text-xs">销售机型名称</TableHead>
            <TableHead className="h-8 text-xs">关联工程机型</TableHead>
            <TableHead className="h-8 text-xs">产品系列</TableHead>
            <TableHead className="h-8 text-xs">默认价格表</TableHead>
            <TableHead className="h-8 text-xs">配置组</TableHead>
            <TableHead className="h-8 text-xs">可见/隐藏</TableHead>
            <TableHead className="h-8 text-xs text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {marketModels.map((model, index) => {
            const totalCats = model.configuration_groups.reduce(
              (sum, g) => sum + g.categories.length, 0
            );
            const hiddenCats = model.configuration_groups.reduce(
              (sum, g) => sum + g.categories.filter(c => c.hide).length, 0
            );
            const linkedPT = priceTables.find(pt => pt.id === model.price_table_id);
            const engName = model.engineer_model_name || getEngineerModelName(model.engineer_model_id);
            return (
              <TableRow key={model.model_id}>
                <TableCell className="py-2 text-xs font-mono">{model.model_id}</TableCell>
                <TableCell className="py-2 text-xs font-medium">{model.model_name}</TableCell>
                <TableCell className="py-2 text-xs">
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Database className="w-2.5 h-2.5" />
                    {engName}
                  </Badge>
                </TableCell>
                <TableCell className="py-2 text-xs">{model.series_info.series_name}</TableCell>
                <TableCell className="py-2 text-xs">
                  {linkedPT ? (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <DollarSign className="w-2.5 h-2.5" />
                      {linkedPT.name}
                    </Badge>
                  ) : (
                    <span className="text-slate-400 text-[10px]">未关联</span>
                  )}
                </TableCell>
                <TableCell className="py-2 text-xs">
                  <Badge variant="secondary" className="text-[10px]">
                    {model.configuration_groups.length}
                  </Badge>
                </TableCell>
                <TableCell className="py-2 text-xs">
                  <div className="flex gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {totalCats - hiddenCats} 可见
                    </Badge>
                    {hiddenCats > 0 && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                        {hiddenCats} 隐藏
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleEdit(index)}
                    >
                      <Pencil className="w-3 h-3" />
                      修订
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                          删除
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-sm">确认删除</AlertDialogTitle>
                          <AlertDialogDescription className="text-xs">
                            确定要删除销售机型 "{model.model_name}" 吗？此操作不可撤销。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="h-7 text-xs">取消</AlertDialogCancel>
                          <AlertDialogAction
                            className="h-7 text-xs bg-red-600 hover:bg-red-700"
                            onClick={() => deleteMarketModel(index)}
                          >
                            删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCancel(); }}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-sm">
              编辑销售机型 - {editingMarketModel?.model_name}
            </DialogTitle>
          </DialogHeader>
          {editingMarketModel && (
            <MarketModelEditor
              model={editingMarketModel}
              onUpdate={updateEditingModel}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}