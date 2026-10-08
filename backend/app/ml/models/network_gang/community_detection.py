"""Community detection over person links: greedy modularity communities plus PageRank leaders.

Reports measurable quantities only (size, density, mean link strength, PageRank) - there is no
composite "gang score" because nothing in the data would calibrate one."""

from __future__ import annotations

import networkx as nx


def detect_communities(edges: list[dict], min_size: int = 2) -> list[dict]:
    graph = nx.Graph()
    for edge in edges:
        a, b = edge["source_person_id"], edge["target_person_id"]
        weight = edge.get("confidence", 1.0)
        if graph.has_edge(a, b):
            weight = 1.0 - (1.0 - graph[a][b]["weight"]) * (1.0 - weight)  # noisy-OR of parallel links
        graph.add_edge(a, b, weight=weight)

    if graph.number_of_edges() == 0:
        return []

    communities = nx.algorithms.community.greedy_modularity_communities(graph, weight="weight")
    results = []
    for community in communities:
        members = sorted(int(node) for node in community)
        if len(members) < min_size:
            continue
        subgraph = graph.subgraph(members)
        ranks = nx.pagerank(subgraph, weight="weight")
        leader = max(ranks, key=ranks.get)
        weights = [data["weight"] for _, _, data in subgraph.edges(data=True)]
        results.append({
            "member_person_ids": members,
            "size": len(members),
            "density": round(nx.density(subgraph), 4),
            "mean_link_strength": round(sum(weights) / len(weights), 4),
            "leader_person_id": int(leader),
            "leader_pagerank": round(float(ranks[leader]), 4),
        })
    return sorted(results, key=lambda item: (item["size"], item["mean_link_strength"]), reverse=True)
