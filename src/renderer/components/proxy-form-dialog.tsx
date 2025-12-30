import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FormData {
    hostname: string;
    localHost: string;
    localPort: number;
}

interface ProxyFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: FormData) => void;
    defaultValues?: {
        hostname: string;
        localHost: string;
        localPort: number;
    };
    isEditing?: boolean;
}

export function ProxyFormDialog({
    open,
    onOpenChange,
    onSubmit,
    defaultValues,
    isEditing = false,
}: ProxyFormDialogProps) {
    const { t } = useTranslation();

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
        defaultValues: defaultValues || {
            hostname: '',
            localHost: 'localhost',
            localPort: 8080,
        },
    });

    useEffect(() => {
        if (open) {
            reset(defaultValues || {
                hostname: '',
                localHost: 'localhost',
                localPort: 8080,
            });
        }
    }, [open, defaultValues, reset]);

    const onFormSubmit = (data: FormData) => {
        onSubmit({
            ...data,
            localPort: Number(data.localPort),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? t('form.editTitle') : t('form.addTitle')}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? 'Modify the ingress rule settings'
                            : 'Add a new ingress rule to proxy traffic'
                        }
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onFormSubmit)}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="hostname">{t('form.hostname')}</Label>
                            <Input
                                id="hostname"
                                placeholder={t('form.hostnamePlaceholder')}
                                {...register('hostname', { required: true })}
                            />
                            {errors.hostname && (
                                <p className="text-sm text-destructive">Hostname is required</p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="localHost">{t('form.localHost')}</Label>
                            <Input
                                id="localHost"
                                placeholder={t('form.localHostPlaceholder')}
                                {...register('localHost', { required: true })}
                            />
                            {errors.localHost && (
                                <p className="text-sm text-destructive">Local host is required</p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="localPort">{t('form.localPort')}</Label>
                            <Input
                                id="localPort"
                                type="number"
                                placeholder={t('form.localPortPlaceholder')}
                                {...register('localPort', {
                                    required: true,
                                    min: 1,
                                    max: 65535,
                                })}
                            />
                            {errors.localPort && (
                                <p className="text-sm text-destructive">Valid port (1-65535) is required</p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {t('form.cancel')}
                        </Button>
                        <Button type="submit">{t('form.save')}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
