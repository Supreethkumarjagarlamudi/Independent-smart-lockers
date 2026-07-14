import { Archive, PackageOpen } from "lucide-react";

import { HomeActionCard } from "./HomeActionCard";

type HomeActionsProps = {
    onDeposit(): void;
    onRetrieve(): void;
};

export function HomeActions({
    onDeposit,
    onRetrieve,
}: HomeActionsProps) {
    return (
        <div className="mx-auto
                w-full
                max-w-[620px]
                space-y-5">

            <HomeActionCard
                icon={<Archive size={34} />}
                title="Deposit"
                description="Store your belongings"
                onClick={onDeposit}
            />

            <HomeActionCard
                icon={<PackageOpen size={34} />}
                title="Retrieve"
                description="Collect your belongings"
                onClick={onRetrieve}
            />

        </div>
    );
}