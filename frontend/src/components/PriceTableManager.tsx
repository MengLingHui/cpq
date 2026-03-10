import { useState } from 'react';
import { useCPQStore } from '@/lib/cpq-store';
import type { PriceTable, PriceTableEntry } from '@/lib/cpq-data';
import { generatePriceTableFromEngineer, CURRENCIES } from '@/lib/cpq-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, DollarSign, Copy, Database } from 'lucide-react';

function PriceTableEditor({
  table,
  onSave,
  onCancel,
}: {
  table: PriceTable;
  onSave: (table: PriceTable) => void;
  onCancel: () => void;
}) {
  const { getEngineerModelName } = useCPQStore();
  const [name, setName] = useState(table.name);
  const [description, setDescription] = useState(table.description);
  const [currency, setCurrency] = useState(table.currency || '¥');
  const [entries, setEntries] = useState<PriceTableEntry[]>([...table.entries]);
  const [filterText, setFilterText] = useState('');

  const engineerModelName = getEngineerModelName(table.engineer_model_id);

  const updateEntryPrice = (index: number, price: number) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], price };
    setEntries(newEntries);
  };

  const filteredEntries = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) =>
      !filterText ||
      entry.option_code.toLowerCase().includes(filterText.toLowerCase()) ||
      entry.description.toLowerCase().includes(filterText.toLowerCase())
    );

  const handleSave = () => {
    onSave({
      ...table,
      name,
      description,
      currency,
      entries,
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">价格表名称</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-7 text-xs mt-1"
            placeholder="输入价格表名称"
          />
        </div>
        <div>
          <Label className="text-xs">描述</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-7 text-xs mt-1"
            placeholder="输入描述"
          />
        </div>
        <div>
          <Label className="text-xs">币种</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="h-7 text-xs mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map(c => (
                <SelectItem key={c.code} value={c.code} className="text-xs">
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Linked engineer model (read-only) */}
      <div>
        <Label className="text-xs font-medium">关联工程机型</Label>
        <div className="mt-1 p-2 bg-slate-50 rounded border">
          <Badge variant="outline" className="text-[10px] gap-1">
            <Database className="w-2.5 h-2.5" />
            {engineerModelName}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="h-7 text-xs max-w-[240px]"
          placeholder="搜索选项编码或内容..."
        />
        <span className="text-[10px] text-slate-500">
          共 {entries.length} 个选项价格 · 币种: {currency}
        </span>
      </div>

      <div className="max-h-[38vh] overflow-y-auto border rounded">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-7 text-[10px] sticky top-0 bg-white z-10 w-10">序号</TableHead>
              <TableHead className="h-7 text-[10px] sticky top-0 bg-white z-10 w-28">选项编码</TableHead>
              <TableHead className="h-7 text-[10px] sticky top-0 bg-white z-10">选项内容</TableHead>
              <TableHead className="h-7 text-[10px] sticky top-0 bg-white z-10 w-32">价格 ({currency})</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.map(({ entry, index }) => (
              <TableRow key={entry.option_code}>
                <TableCell className="py-1 text-[10px] text-slate-400">{index + 1}</TableCell>
                <TableCell className="py-1 text-[11px] font-mono">{entry.option_code}</TableCell>
                <TableCell className="py-1 text-[11px] text-slate-600 max-w-[300px] truncate">
                  {entry.description || '-'}
                </TableCell>
                <TableCell className="py-1">
                  <Input
                    type="number"
                    value={entry.price}
                    onChange={(e) => updateEntryPrice(index, Number(e.target.value))}
                    className="h-6 text-[11px] w-[120px]"
                    min={0}
                    step={100}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>
          取消
        </Button>
        <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
          保存
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function PriceTableManager() {
  const { priceTables, addPriceTable, updatePriceTable, deletePriceTable, marketModels, engineerModels, getEngineerModelName } = useCPQStore();
  const [editingTable, setEditingTable] = useState<PriceTable | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // For the "select engineer model" step when creating
  const [selectEngDialogOpen, setSelectEngDialogOpen] = useState(false);

  const handleCreate = () => {
    if (engineerModels.length === 0) {
      alert('暂无工程机型，无法创建价格表');
      return;
    }
    if (engineerModels.length === 1) {
      // Only one engineer model, skip selection
      createForEngineerModel(engineerModels[0].model_id);
    } else {
      // Multiple engineer models, show selection dialog
      setSelectEngDialogOpen(true);
    }
  };

  const createForEngineerModel = (engModelId: string) => {
    const engModel = engineerModels.find(e => e.model_id === engModelId);
    if (!engModel) return;

    const newTable = generatePriceTableFromEngineer(
      engModel,
      `价格表 ${priceTables.length + 1}`,
      `创建于 ${new Date().toLocaleDateString('zh-CN')}`
    );
    setEditingTable(newTable);
    setSelectEngDialogOpen(false);
    setDialogOpen(true);
  };

  const handleDuplicate = (table: PriceTable) => {
    const newTable: PriceTable = {
      ...JSON.parse(JSON.stringify(table)),
      id: `pt_${Date.now()}`,
      name: `${table.name} (副本)`,
      created_at: new Date().toISOString(),
    };
    setEditingTable(newTable);
    setDialogOpen(true);
  };

  const handleEdit = (table: PriceTable) => {
    setEditingTable(JSON.parse(JSON.stringify(table)));
    setDialogOpen(true);
  };

  const handleSave = (table: PriceTable) => {
    const existing = priceTables.find(t => t.id === table.id);
    if (existing) {
      updatePriceTable(table);
    } else {
      addPriceTable(table);
    }
    setDialogOpen(false);
    setEditingTable(null);
  };

  const handleDelete = (id: string) => {
    const inUse = marketModels.some(m => m.price_table_id === id);
    if (inUse) {
      alert('该价格表正在被销售机型使用，无法删除');
      return;
    }
    deletePriceTable(id);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">价格表管理</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            维护选项价格表，支持多币种。价格表关联工程机型，销售机型选择价格表时仅显示关联相同工程机型的价格表。
          </p>
        </div>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={handleCreate}>
          <Plus className="w-3 h-3" />
          新建价格表
        </Button>
      </div>

      {priceTables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <DollarSign className="w-12 h-12 mb-3" />
          <p className="text-sm">暂无价格表</p>
          <p className="text-xs mt-1">点击上方按钮创建价格表</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-8 text-xs">价格表名称</TableHead>
              <TableHead className="h-8 text-xs">描述</TableHead>
              <TableHead className="h-8 text-xs">关联工程机型</TableHead>
              <TableHead className="h-8 text-xs">币种</TableHead>
              <TableHead className="h-8 text-xs">选项数</TableHead>
              <TableHead className="h-8 text-xs">创建时间</TableHead>
              <TableHead className="h-8 text-xs text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {priceTables.map((table) => {
              const engName = getEngineerModelName(table.engineer_model_id);
              return (
                <TableRow key={table.id}>
                  <TableCell className="py-2 text-xs font-medium">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-3 h-3 text-emerald-600" />
                      {table.name}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-xs text-slate-500">{table.description}</TableCell>
                  <TableCell className="py-2 text-xs">
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Database className="w-2.5 h-2.5" />
                      {engName}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    <Badge variant="secondary" className="text-[10px]">
                      {table.currency || '¥'}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    <Badge variant="secondary" className="text-[10px]">
                      {table.entries.length}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-xs text-slate-500">
                    {new Date(table.created_at).toLocaleDateString('zh-CN')}
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleEdit(table)}
                      >
                        <Pencil className="w-3 h-3" />
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleDuplicate(table)}
                      >
                        <Copy className="w-3 h-3" />
                        复制
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(table.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Select Engineer Model Dialog (for creating new price table) */}
      <Dialog open={selectEngDialogOpen} onOpenChange={(open) => { if (!open) setSelectEngDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              选择工程机型
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-slate-500">请先选择要关联的工程机型，价格表的选项将基于该工程机型生成。</p>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {engineerModels.map(eng => (
                <div
                  key={eng.model_id}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  onClick={() => createForEngineerModel(eng.model_id)}
                >
                  <Database className="w-5 h-5 text-blue-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">{eng.model_name}</div>
                    <div className="text-[10px] text-slate-500">{eng.series_info.series_description}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{eng.model_id}</div>
                  </div>
                  <Badge variant="secondary" className="text-[9px]">
                    {eng.configuration_groups.reduce((sum, g) => sum + g.categories.length, 0)} 配置项
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Price Table Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditingTable(null); } }}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editingTable && priceTables.find(t => t.id === editingTable.id) ? '编辑价格表' : '新建价格表'}
            </DialogTitle>
          </DialogHeader>
          {editingTable && (
            <PriceTableEditor
              table={editingTable}
              onSave={handleSave}
              onCancel={() => { setDialogOpen(false); setEditingTable(null); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}