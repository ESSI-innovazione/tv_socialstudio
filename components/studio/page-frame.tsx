import type { ReactNode } from "react";
import type { StudioUser } from "@/auth";
import { PageHeader, type Crumb } from "./ui";

interface Props {
  /** Non serve piu' alla cornice, che e' nel layout: resta accettato per le pagine che lo passano ancora. */
  user?: StudioUser;
  title: string;
  description?: string;
  breadcrumb?: Crumb[];
  /** Un'azione in testata, a destra del titolo. */
  action?: ReactNode;
  children: ReactNode;
  /** Larghezza massima del contenuto. */
  width?: number;
}

/**
 * La cornice delle pagine intorno alla console: un titolo e il contenuto
 * che scorre. La barra laterale la mette il layout di /studio.
 */
export function PageFrame({ title, description, breadcrumb, action, children, width = 1100 }: Props) {
  return (
    <main className="tv-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full flex-col gap-5 px-4 py-6 md:px-8 md:py-7" style={{ maxWidth: width }}>
        <PageHeader title={title} subtitle={description} breadcrumb={breadcrumb} actions={action} />
        {children}
      </div>
    </main>
  );
}
