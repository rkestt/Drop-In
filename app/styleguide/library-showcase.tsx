"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Drawer } from "@base-ui/react/drawer";
import { Popover } from "@base-ui/react/popover";
import { Menu } from "@base-ui/react/menu";
import { Select } from "@base-ui/react/select";
import { Combobox } from "@base-ui/react/combobox";
import { Tabs } from "@base-ui/react/tabs";
import { Accordion } from "@base-ui/react/accordion";
import { Tooltip } from "@base-ui/react/tooltip";
import { Switch } from "@base-ui/react/switch";
import { Slider } from "@base-ui/react/slider";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown } from "lucide-react";

const trigger =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-control border border-[var(--border)] bg-[var(--bg-surface)] px-4 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]";
const popup =
  "z-50 rounded-card border border-[var(--border)] bg-[var(--bg-elevated)] p-2 text-[var(--text-primary)] shadow-lg outline-none";
const item =
  "flex min-h-[44px] cursor-pointer select-none items-center gap-2 rounded-control-sm px-3 text-sm outline-none data-[highlighted]:bg-[var(--bg-surface)]";

function Card({
  title,
  source,
  children,
  note,
}: {
  title: string;
  source: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
        <span className="rounded-chip border border-[var(--border)] px-2 py-0.5 text-label uppercase tracking-wider text-[var(--text-secondary)]">
          {source}
        </span>
      </div>
      {note ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function DialogExample() {
  return (
    <Dialog.Root>
      <Dialog.Trigger className={trigger}>Apri dialog</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[var(--overlay)]" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-card border border-[var(--border)] bg-[var(--bg-elevated)] p-5 text-[var(--text-primary)] shadow-lg outline-none">
          <Dialog.Title className="text-lg font-semibold">Confermi il check-in?</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-[var(--text-secondary)]">
            Sei al Campo Nomentano. Il check-in scade tra 2 ore.
          </Dialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close className={trigger}>Annulla</Dialog.Close>
            <Dialog.Close className="inline-flex min-h-[44px] items-center rounded-control bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)]">
              Conferma
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DrawerExample() {
  return (
    <Drawer.Root swipeDirection="down">
      <Drawer.Trigger className={trigger}>Apri drawer</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-50 bg-[var(--overlay)]" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
          <Drawer.Popup className="w-full max-w-[720px] rounded-t-sheet border border-[var(--border)] bg-[var(--bg-elevated)] p-5 pb-8 text-[var(--text-primary)] shadow-lg outline-none">
            <Drawer.Title className="text-lg font-semibold">Crea lobby</Drawer.Title>
            <Drawer.Description className="mt-1 text-sm text-[var(--text-secondary)]">
              Scegli orario e posti. Puoi modificarla fino a 30 minuti prima.
            </Drawer.Description>
            <div className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="lib-drawer-nome"
                  className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
                >
                  Nome lobby
                </label>
                <input
                  id="lib-drawer-nome"
                  placeholder="Es. Serale al Nomentano"
                  className="min-h-[44px] w-full rounded-control border border-[var(--border)] bg-[var(--bg-surface)] px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
              </div>
              <div className="flex gap-2">
                <Drawer.Close className={trigger}>Annulla</Drawer.Close>
                <Drawer.Close className="inline-flex min-h-[44px] items-center rounded-control bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)]">
                  Crea
                </Drawer.Close>
              </div>
            </div>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function PopoverExample() {
  return (
    <Popover.Root>
      <Popover.Trigger className={trigger}>Apri popover</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup className={popup}>
            <Popover.Title className="px-3 pt-1 text-sm font-semibold">Filtri</Popover.Title>
            <p className="px-3 pb-2 text-sm text-[var(--text-secondary)]">
              Sport, superficie, copertura.
            </p>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function MenuExample() {
  return (
    <Menu.Root>
      <Menu.Trigger className={trigger}>
        Azioni <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8}>
          <Menu.Popup className={popup}>
            <Menu.Item className={item}>Modifica campo</Menu.Item>
            <Menu.Item className={item}>Segnala</Menu.Item>
            <Menu.Separator className="my-1 h-px bg-[var(--border)]" />
            <Menu.Item className={item}>Elimina</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function SelectExample() {
  return (
    <Select.Root
      defaultValue="basket"
      items={[
        { value: "basket", label: "Basket" },
        { value: "calcio", label: "Calcio" },
        { value: "volley", label: "Volley" },
      ]}
    >
      <Select.Trigger aria-label="Sport" className={trigger}>
        <Select.Value />
        <Select.Icon>
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={8}>
          <Select.Popup className={popup}>
            <Select.Item className={item} value="basket">
              <Select.ItemText>Basket</Select.ItemText>
            </Select.Item>
            <Select.Item className={item} value="calcio">
              <Select.ItemText>Calcio</Select.ItemText>
            </Select.Item>
            <Select.Item className={item} value="volley">
              <Select.ItemText>Volley</Select.ItemText>
            </Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

function ComboboxExample() {
  const items = ["Campo Nomentano", "Campo Trastevere", "Campo Pigneto", "Campo San Lorenzo"];
  return (
    <Combobox.Root items={items}>
      <Combobox.Input
        aria-label="Cerca un campo"
        placeholder="Cerca un campo…"
        className="min-h-[44px] w-full rounded-control border border-[var(--border)] bg-[var(--bg-surface)] px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      />
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={8}>
          <Combobox.Popup className={popup}>
            <Combobox.List>
              {(value: string) => (
                <Combobox.Item key={value} className={item} value={value}>
                  {value}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

function TabsExample() {
  return (
    <Tabs.Root defaultValue="near">
      <Tabs.List className="flex gap-1 rounded-control bg-[var(--bg-base)] p-1">
        <Tabs.Tab
          value="near"
          className="min-h-[44px] flex-1 rounded-control-sm px-3 text-sm font-semibold text-[var(--text-secondary)] data-[selected]:bg-[var(--bg-elevated)] data-[selected]:text-[var(--text-primary)]"
        >
          Vicine
        </Tabs.Tab>
        <Tabs.Tab
          value="mine"
          className="min-h-[44px] flex-1 rounded-control-sm px-3 text-sm font-semibold text-[var(--text-secondary)] data-[selected]:bg-[var(--bg-elevated)] data-[selected]:text-[var(--text-primary)]"
        >
          Mie
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="near" className="mt-3 text-sm text-[var(--text-secondary)]">
        3 lobby entro 2 km.
      </Tabs.Panel>
      <Tabs.Panel value="mine" className="mt-3 text-sm text-[var(--text-secondary)]">
        Non hai lobby attive.
      </Tabs.Panel>
    </Tabs.Root>
  );
}

function AccordionExample() {
  return (
    <Accordion.Root>
      <Accordion.Item value="rules">
        <Accordion.Header>
          <Accordion.Trigger className="flex min-h-[44px] w-full items-center justify-between text-left text-sm font-semibold text-[var(--text-primary)]">
            Regole del campo
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel className="pb-3 text-sm text-[var(--text-secondary)]">
          Rispetta gli orari, porta il pallone, niente materiali abbandonati.
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  );
}

function TooltipExample() {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger className={trigger}>Passa il mouse</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={8}>
            <Tooltip.Popup className="z-50 rounded-control border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-lg">
              Apre tra 300 ms.
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function SwitchExample() {
  return (
    <Switch.Root
      defaultChecked
      aria-label="Esempio switch"
      className="relative inline-flex h-7 w-12 items-center rounded-chip bg-[var(--bg-base)] data-[checked]:bg-[var(--accent)]"
    >
      <Switch.Thumb className="h-5 w-5 translate-x-1 rounded-full bg-[var(--text-primary)] transition-transform data-[checked]:translate-x-6 data-[checked]:bg-[var(--accent-foreground)]" />
    </Switch.Root>
  );
}

function SliderExample() {
  return (
    <Slider.Root defaultValue={[40]} className="w-full">
      <Slider.Control className="flex h-11 items-center">
        <Slider.Track className="relative h-1.5 w-full rounded-chip bg-[var(--bg-base)]">
          <Slider.Indicator className="rounded-chip bg-[var(--accent)]" />
          <Slider.Thumb aria-label="Valore di esempio" className="h-5 w-5 rounded-full border-2 border-[var(--accent)] bg-[var(--bg-elevated)]" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}

function ToastExample() {
  // Il <Toaster /> globale è montato una sola volta nel root layout:
  // qui si usa solo `toast` per generare l'esito.
  return (
    <button
      type="button"
      className={trigger}
      onClick={() => toast.success("Campo aggiunto", { description: "In attesa di moderazione." })}
    >
      Mostra toast
    </button>
  );
}

function MotionExample() {
  const [open, setOpen] = React.useState(true);
  return (
    <div className="space-y-3">
      <button type="button" className={trigger} onClick={() => setOpen((v) => !v)}>
        {open ? "Nascondi" : "Mostra"} card
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
            className="rounded-control border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-primary)]"
          >
            Card animata con Motion. Usala per exit, drag e layout.
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const formSchema = z.object({
  name: z.string().min(2, "Minimo 2 caratteri"),
});
type FormValues = z.infer<typeof formSchema>;

function FormExample() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitSuccessful },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  return (
    <form
      onSubmit={handleSubmit(() => undefined)}
      className="space-y-2"
      noValidate
    >
      <label className="block text-sm font-medium text-[var(--text-secondary)]" htmlFor="lib-name">
        Nome campo
      </label>
      <input
        id="lib-name"
        {...register("name")}
        aria-invalid={errors.name ? "true" : undefined}
        className="min-h-[44px] w-full rounded-control border border-[var(--border)] bg-[var(--bg-surface)] px-4 text-sm text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      />
      {errors.name ? (
        <p className="text-sm text-[var(--danger-dark)]">{errors.name.message}</p>
      ) : null}
      <button
        type="submit"
        className="inline-flex min-h-[44px] items-center rounded-control bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)]"
      >
        Valida
      </button>
      {isSubmitSuccessful ? (
        <p className="text-sm text-[var(--success-dark)]">Valido.</p>
      ) : null}
    </form>
  );
}

export function LibraryShowcase() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Dialog" source="Base UI" note="Conferme, check-in, distruttive.">
          <DialogExample />
        </Card>
        <Card title="Drawer" source="Base UI" note="Bottom sheet per 1–2 passi.">
          <DrawerExample />
        </Card>
        <Card title="Popover" source="Base UI" note="Filtri e dettagli contestuali.">
          <PopoverExample />
        </Card>
        <Card title="Menu" source="Base UI" note="Azioni su card e campo.">
          <MenuExample />
        </Card>
        <Card title="Select" source="Base UI" note="Sport, superficie, posti.">
          <SelectExample />
        </Card>
        <Card title="Combobox" source="Base UI" note="Ricerca campo con suggerimenti.">
          <ComboboxExample />
        </Card>
        <Card title="Tabs" source="Base UI" note="Vicine / Mie, filtri.">
          <TabsExample />
        </Card>
        <Card title="Accordion" source="Base UI" note="Regole, dettagli lunghi.">
          <AccordionExample />
        </Card>
        <Card title="Tooltip" source="Base UI" note="Solo desktop, mai azioni.">
          <TooltipExample />
        </Card>
        <Card title="Switch" source="Base UI" note="Impostazioni on/off.">
          <SwitchExample />
        </Card>
        <Card title="Slider" source="Base UI" note="Raggio, posti, filtri numerici.">
          <SliderExample />
        </Card>
        <Card title="Toast" source="Sonner" note="Feedback immediato, 9 kB.">
          <ToastExample />
        </Card>
        <Card title="Motion" source="motion" note="Exit, drag, layout.">
          <MotionExample />
        </Card>
        <Card title="Form" source="react-hook-form + zod" note="Validazione condivisa.">
          <FormExample />
        </Card>
      </div>
    </div>
  );
}
