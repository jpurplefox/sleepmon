import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "../api/client";
import { DistributionChart } from "../components/DistributionChart";
import { MemberCard } from "../components/MemberCard";
import { MemberForm } from "../components/MemberForm";
import type { MemberInput } from "../types";

export function Team() {
  const qc = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const catalog = useQuery({ queryKey: ["catalog"], queryFn: api.getCatalog });
  const members = useQuery({ queryKey: ["members"], queryFn: api.listMembers });
  const distributions = useQuery({
    queryKey: ["distributions"],
    queryFn: api.getDistributions,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["members"] });
    qc.invalidateQueries({ queryKey: ["distributions"] });
  };

  const create = useMutation({
    mutationFn: (data: MemberInput) => api.createMember(data),
    onSuccess: () => {
      setFormError(null);
      invalidate();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteMember(id),
    onSuccess: invalidate,
  });

  const natureByName = new Map((catalog.data?.natures ?? []).map((n) => [n.name, n]));

  if (catalog.isLoading) return <p className="muted">Cargando catálogo…</p>;
  if (catalog.isError || !catalog.data)
    return <p className="error">No se pudo cargar el catálogo. ¿Está el backend en :8000?</p>;

  return (
    <div className="layout">
      <header className="hero">
        <h1>🌙 Mi equipo de Pokémon Sleep</h1>
        <p className="muted">
          Registrá tus Pokémon con su naturaleza, sub skills e ingredientes, y mirá la
          distribución de todo el equipo.
        </p>
      </header>

      <div className="grid">
        <div className="col">
          <MemberForm
            catalog={catalog.data}
            onSubmit={(data) => create.mutate(data)}
            pending={create.isPending}
            error={formError}
          />
        </div>

        <div className="col">
          <h2>
            Equipo {members.data ? `(${members.data.length})` : ""}
          </h2>
          {members.isLoading && <p className="muted">Cargando equipo…</p>}
          {members.data?.length === 0 && <p className="muted">Todavía no agregaste Pokémon.</p>}
          <div className="members">
            {members.data?.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                nature={natureByName.get(m.nature)}
                onDelete={(id) => remove.mutate(id)}
              />
            ))}
          </div>
        </div>
      </div>

      {distributions.data && (
        <section className="distributions">
          <h2>Distribución del equipo</h2>
          <div className="grid grid--3">
            <DistributionChart
              title="Ingredientes"
              data={distributions.data.ingredients}
              color="#f59e0b"
            />
            <DistributionChart
              title="Sub skills"
              data={distributions.data.sub_skills}
              color="#6366f1"
            />
            <DistributionChart
              title="Naturalezas"
              data={distributions.data.natures}
              color="#10b981"
            />
          </div>
        </section>
      )}
    </div>
  );
}
