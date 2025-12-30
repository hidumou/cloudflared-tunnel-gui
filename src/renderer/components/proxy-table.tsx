import { useTranslation } from 'react-i18next';
import { Pencil, Trash2, ExternalLink, Globe, Loader2, Circle } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import type { ProxyItem } from '@/store/app-store';

interface ProxyTableProps {
    items: ProxyItem[];
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
}

const dnsStatusConfig = {
    configured: { label: 'dns.configured', icon: Globe, colorClass: 'text-green-500', iconClass: '' },
    pending: { label: 'dns.pending', icon: Globe, colorClass: 'text-yellow-500', iconClass: '' },
    error: { label: 'dns.error', icon: Globe, colorClass: 'text-red-500', iconClass: '' },
    checking: { label: 'dns.checking', icon: Loader2, colorClass: 'text-muted-foreground', iconClass: 'animate-spin' },
};

export function ProxyTable({ items, onEdit, onDelete }: ProxyTableProps) {
    const { t } = useTranslation();

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">{t('dashboard.noRules')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('dashboard.noRulesDescription')}</p>
            </div>
        );
    }

    return (
        <TooltipProvider>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t('table.hostname')}</TableHead>
                        <TableHead>{t('table.localHost')}</TableHead>
                        <TableHead>{t('table.localPort')}</TableHead>
                        <TableHead>{t('table.dnsStatus')}</TableHead>
                        <TableHead className="text-right">{t('table.actions')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item) => {
                        const dnsStatus = dnsStatusConfig[item.dnsStatus] || dnsStatusConfig.checking;
                        const DnsIcon = dnsStatus.icon;

                        // Port status indicator
                        const portStatusColor = item.localStatus === 'active'
                            ? 'text-green-500 fill-green-500'
                            : item.localStatus === 'error'
                                ? 'text-red-500 fill-red-500'
                                : 'text-muted-foreground fill-muted-foreground';
                        const portStatusLabel = item.localStatus === 'active'
                            ? t('status.portRunning')
                            : item.localStatus === 'error'
                                ? t('status.portStopped')
                                : t('status.checking');

                        return (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium">
                                    <div
                                        className="flex items-center gap-1 cursor-pointer hover:text-primary hover:underline group"
                                        onClick={() => window.electronAPI.openExternal(`https://${item.hostname}`)}
                                        title={t('table.openExternal')}
                                    >
                                        {item.hostname}
                                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </TableCell>
                                <TableCell>{item.localHost}</TableCell>
                                <TableCell>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1.5">
                                                <span>{item.localPort}</span>
                                                <Circle className={`h-2.5 w-2.5 ${portStatusColor}`} />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{portStatusLabel}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TableCell>
                                <TableCell>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1">
                                                <DnsIcon className={`h-4 w-4 ${dnsStatus.colorClass} ${dnsStatus.iconClass}`} />
                                                <span className={`text-xs ${dnsStatus.colorClass}`}>
                                                    {t(dnsStatus.label)}
                                                </span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{t('dns.tooltip')}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onEdit(item.id)}
                                            title={t('table.edit')}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onDelete(item.id)}
                                            title={t('table.delete')}
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </TooltipProvider>
    );
}
