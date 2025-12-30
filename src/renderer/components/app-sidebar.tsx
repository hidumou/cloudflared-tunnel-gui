import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    LayoutDashboard,
    Settings,
    FileCode,
    CloudCog
} from 'lucide-react';
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';

const menuItems = [
    { key: 'dashboard', path: '/', icon: LayoutDashboard },
    { key: 'config', path: '/config', icon: FileCode },
    { key: 'settings', path: '/settings', icon: Settings },
];

export function AppSidebar() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <Sidebar>
            <SidebarHeader className="drag-region border-b border-sidebar-border px-4 py-4 pt-10">
                <div className="flex items-center gap-2">
                    <CloudCog className="h-6 w-6 text-primary" />
                    <span className="font-semibold text-lg">{t('app.name')}</span>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {menuItems.map((item) => (
                                <SidebarMenuItem key={item.key}>
                                    <SidebarMenuButton
                                        isActive={location.pathname === item.path}
                                        onClick={() => navigate(item.path)}
                                        className="cursor-pointer"
                                    >
                                        <item.icon className="h-4 w-4" />
                                        <span>{t(`nav.${item.key}`)}</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
}
