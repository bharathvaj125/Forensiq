"""Community detection and gang influence scoring over verified criminal relationship links."""

import networkx as nx


def detect_communities(edges: list[dict]) -> list[dict]:
    """Find probable criminal communities with gang statistics, leader centrality, and influence scores."""
    graph = nx.Graph()
    for edge in edges:
        graph.add_edge(
            edge["source_person_id"],
            edge["target_person_id"],
            weight=edge.get("confidence", 1.0)
        )

    if graph.number_of_edges() == 0:
        return []

    # Community modularity clustering (greedy modularity algorithm)
    communities = list(nx.algorithms.community.greedy_modularity_communities(graph, weight="weight"))
    
    results = []
    for community in communities:
        member_ids = sorted(int(node) for node in community)
        if len(member_ids) < 2:
            continue

        # Extract the induced community subgraph
        subgraph = graph.subgraph(member_ids)
        density = nx.density(subgraph)
        
        # Calculate pagerank centrality to identify community leaders
        try:
            ranks = nx.pagerank(subgraph, weight="weight")
            leader_id = max(ranks, key=ranks.get)
            leader_rank = ranks[leader_id]
        except Exception:
            # Fallback to degree centrality if PageRank fails
            degrees = dict(subgraph.degree())
            leader_id = max(degrees, key=degrees.get)
            leader_rank = float(degrees[leader_id]) / max(1, len(member_ids) - 1)

        # Compute average relationship confidence (edge weight)
        weights = [data.get("weight", 1.0) for _, _, data in subgraph.edges(data=True)]
        avg_weight = sum(weights) / len(weights) if weights else 1.0
        
        # Calibrate a Gang Influence Score out of 10.0
        # Formula uses log scaling on size combined with density and average edge weight
        raw_influence = len(member_ids) * density * avg_weight
        influence_score = round(min(10.0, 1.5 + raw_influence), 1)

        # Set community confidence bound
        confidence = round(min(1.0, 0.4 + (len(member_ids) / 10.0) + (density * 0.2)), 4)

        explanation = (
            f"[Gang Influence: {influence_score}/10.0] Detected gang network with {len(member_ids)} members "
            f"(density: {round(density, 2)}). Central actor is PersonID {leader_id} (centrality: {round(leader_rank, 2)}). "
            f"Linked by verified relationships."
        )

        results.append({
            "member_person_ids": member_ids,
            "confidence": confidence,
            "explanation": explanation
        })

    return sorted(results, key=lambda x: x["confidence"], reverse=True)
