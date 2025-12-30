import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogIn, LogOut, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/components/theme-provider';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';

export default function Settings() {
    const { t, i18n } = useTranslation();
    const { theme, setTheme } = useTheme();
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const { isAuthenticated, setAuthenticated } = useAppStore();

    useEffect(() => {
        const checkAuth = async () => {
            if (!window.electronAPI) return;
            try {
                const result = await window.electronAPI.checkAuth();
                setAuthenticated(result.authenticated);
            } catch (error) {
                console.error('Failed to check auth:', error);
            }
        };
        checkAuth();
    }, [setAuthenticated]);

    const handleLanguageChange = (value: string) => {
        i18n.changeLanguage(value);
        localStorage.setItem('language', value);
    };

    const handleLogin = async () => {
        if (!window.electronAPI) return;

        setIsLoggingIn(true);
        try {
            const result = await window.electronAPI.login();
            if (result.success) {
                setAuthenticated(true);
                toast.success(t('settings.loginSuccess'));
            } else {
                toast.error(result.error || t('settings.loginFailed'));
            }
        } catch (error) {
            toast.error(t('settings.loginFailed'));
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleLogout = async () => {
        if (!window.electronAPI) return;

        setIsLoggingOut(true);
        try {
            const result = await window.electronAPI.logout();
            if (result.success) {
                setAuthenticated(false);
                toast.success(t('settings.logoutSuccess'));
            } else {
                toast.error(result.error || t('settings.logoutFailed'));
            }
        } catch (error) {
            toast.error(t('settings.logoutFailed'));
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
            </div>

            {/* Language Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{t('settings.language')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <Label htmlFor="language" className="min-w-[100px]">{t('settings.language')}</Label>
                        <Select value={i18n.language} onValueChange={handleLanguageChange}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="en">English</SelectItem>
                                <SelectItem value="zh">中文</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Theme Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{t('settings.theme')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <Label htmlFor="theme" className="min-w-[100px]">{t('settings.theme')}</Label>
                        <Select value={theme} onValueChange={(value: 'light' | 'dark' | 'system') => setTheme(value)}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="light">{t('settings.themeLight')}</SelectItem>
                                <SelectItem value="dark">{t('settings.themeDark')}</SelectItem>
                                <SelectItem value="system">{t('settings.themeSystem')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Auth Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{t('settings.auth')}</CardTitle>
                    <CardDescription>{t('settings.authDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Label className="min-w-[100px]">{t('settings.authStatus')}</Label>
                        <Badge variant={isAuthenticated ? 'default' : 'secondary'} className="gap-1">
                            {isAuthenticated ? (
                                <>
                                    <Check className="h-3 w-3" />
                                    {t('settings.authenticated')}
                                </>
                            ) : (
                                <>
                                    <X className="h-3 w-3" />
                                    {t('settings.notAuthenticated')}
                                </>
                            )}
                        </Badge>
                    </div>
                    <div className="flex gap-2">
                        {!isAuthenticated ? (
                            <Button onClick={handleLogin} disabled={isLoggingIn}>
                                <LogIn className="h-4 w-4 mr-2" />
                                {t('settings.login')}
                            </Button>
                        ) : (
                            <Button onClick={handleLogout} disabled={isLoggingOut} variant="destructive">
                                <LogOut className="h-4 w-4 mr-2" />
                                {t('settings.logout')}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
