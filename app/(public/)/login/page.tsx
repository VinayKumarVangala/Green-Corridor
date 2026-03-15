import { RoleSelector } from "@/components/modules/auth/RoleSelector";

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-4xl w-full">
                <RoleSelector />
            </div>
        </div>
    );
}
