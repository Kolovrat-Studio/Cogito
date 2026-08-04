import { notes, currentNoteId } from "./state.js";

let simulation = null;

export function openGraphModal() {
  document.getElementById("graphModal")?.classList.remove("hidden");
  renderGraph();
}

export function closeGraphModal() {
  document.getElementById("graphModal")?.classList.add("hidden");
  if (simulation) {
    simulation.stop();
    simulation = null;
  }
}

function extractWikilinks(content = "") {
  return Array.from(content.matchAll(/\[\[([^\]]+)\]\]/g), m => m[1].trim().toLowerCase());
}

export function renderGraph() {
  const container = document.getElementById("graphContainer");
  if (!container) return;
  container.innerHTML = "";

  const nodes = [];
  const links = [];
  const noteTitleMap = new Map(); 

  const activeNotes = notes.filter(n => !n.isDeleted);

  activeNotes.forEach(n => {
    const title = (n.title || "Untitled").trim();
    const lTitle = title.toLowerCase();
    noteTitleMap.set(lTitle, n.id);
    nodes.push({
      id: n.id,
      title: title,
      group: n.id === currentNoteId ? 1 : 2,
      radius: n.id === currentNoteId ? 12 : 8
    });
  });

  activeNotes.forEach(n => {
    if (!n.content) return;
    const linkedTitles = extractWikilinks(n.content);
    linkedTitles.forEach(lTitle => {
      const targetId = noteTitleMap.get(lTitle);
      if (targetId && targetId !== n.id) {
        links.push({
          source: n.id,
          target: targetId,
          value: 1
        });
      }
    });
  });

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;

  const svg = d3.select("#graphContainer")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("style", "max-width: 100%; height: auto;");

  const g = svg.append("g");

  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

  svg.call(zoom);

  simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(d => d.radius + 10).iterations(2));

  const isDark = document.documentElement.classList.contains("dark");
  const linkColor = isDark ? "#3f3f46" : "#e5e7eb";
  const nodeColorCurrent = isDark ? "#ffffff" : "#000000";
  const nodeColorOther = isDark ? "#71717a" : "#9ca3af";
  const textColor = isDark ? "#a1a1aa" : "#4b5563";

  const link = g.append("g")
    .attr("stroke", linkColor)
    .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke-width", d => Math.sqrt(d.value));

  const node = g.append("g")
    .attr("stroke", isDark ? "#18181b" : "#ffffff")
    .attr("stroke-width", 1.5)
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", d => d.radius)
    .attr("fill", d => d.group === 1 ? nodeColorCurrent : nodeColorOther)
    .call(drag(simulation));

  const labels = g.append("g")
    .selectAll("text")
    .data(nodes)
    .join("text")
    .attr("dx", 12)
    .attr("dy", 4)
    .attr("fill", textColor)
    .attr("font-size", "10px")
    .attr("font-family", "sans-serif")
    .attr("pointer-events", "none")
    .text(d => d.title);

  node.on("click", (event, d) => {
    window.selectNote(d.id);
    closeGraphModal();
  });

  node.on("mouseover", function(event, d) {
    d3.select(this).attr("stroke", "#3b82f6").attr("stroke-width", 2);
    labels.filter(l => l.id === d.id).attr("font-weight", "bold").attr("fill", isDark ? "#fff" : "#000");
  });

  node.on("mouseout", function(event, d) {
    d3.select(this).attr("stroke", isDark ? "#18181b" : "#ffffff").attr("stroke-width", 1.5);
    labels.filter(l => l.id === d.id).attr("font-weight", "normal").attr("fill", textColor);
  });

  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);
      
    labels
      .attr("x", d => d.x)
      .attr("y", d => d.y);
  });

  function drag(simulation) {
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
    return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }
}