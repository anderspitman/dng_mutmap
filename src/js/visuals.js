// eslint exceptions
//
/* global d3 */
/* global utils */
/* exported visuals */

var visuals = (function($, d3, store) {
  "use strict";

  var format = d3.format(",.6e");

  store.subscribe(stateChanged);
 

  function render(graphData, vcfData) {

    var nodes = graphData.nodes;
    var links = graphData.links;

    d3.selectAll("svg").remove();

    var zoom = d3.zoom()
      .on("zoom", zoomed);

    var browserWrapper = d3.select('#browser_wrapper');

    var minPos = d3.min(vcfData.records, function(d) {
      return d.POS;
    });
    var maxPos = d3.max(vcfData.records, function(d) {
      return d.POS;
    });
    var metadata = {
      minPos: minPos,
      maxPos: maxPos
    };

    var browser = genomeBrowserView.createGenomeBrowser()
      .store(store)
      .vcfData(vcfData)
      .metadata(metadata);

    browser(browserWrapper);

    var chartWrapper = d3.select("#chart_wrapper");

    var svg = chartWrapper.append("svg");
    var width = $("svg").parent().width();
    var height = $("svg").parent().height();

    console.log(width, height);

    svg
        .attr("width", width)
        .attr("height", height);

    var container = svg.call(zoom)
      .append("g");

    d3.select("#sample_tree_toggle").on("click", function() {
      var action = {
        type: "TOGGLE_SAMPLE_TREES"
      };
      store.dispatch(action);
    });

    var visualLinks = container
      .append("g")
        .attr("class", "links")
      .selectAll("line")
        .data(links)
      .enter().append("g")
        .attr("class", "link");

    visualLinks.append("path")
        .attr("d", function(d) {
          if (d.type == "child" || d.type == "spouse") {
            return "M" + d.source.x + "," + d.source.y +
              "L" + d.target.x + "," + d.target.y;
          }
          else {
            var controlX = utils.halfwayBetween(d.source.x, d.target.x);
            // TODO: parameterize the control point Y value by the distance
            // between the nodes, rather than hard coding
            var controlY = d.source.y - 100;
            return "M" + d.source.x + "," + d.source.y
              + "Q" + controlX + "," + controlY + ","
              + d.target.x + "," + d.target.y;
          }
        })
        .attr("fill", "transparent")
        .attr("stroke-width", function(d) {
          if (linkHasData(d)) {
            return 5;
          }
          return 1;
        })
        .attr("stroke", function(d) {
          if (linkHasData(d)) {
            return "green";
          }

          return "#999";
        })
        .attr("stroke-dasharray", function(d) {
          if (d.type == "duplicate") {
            return "5, 5";
          }
        })
        .attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

    visualLinks.append("text")
      .attr("dx", function(d) {
        return utils.halfwayBetween(d.source.x, d.target.x) - 45;
      })
      .attr("dy", function(d) {
        return utils.halfwayBetween(d.source.y, d.target.y);
      })
      .text(function(d) {
        if (linkHasData(d)) {
          return d.dataLink.data.mutation;
        }
      });

    function linkHasData(d) {
      return d.dataLink !== undefined && d.dataLink.data !== undefined;
    }

    var visualNodes = container
      .append("g")
        .attr("class", "nodes")
      .selectAll(".node")
      .data(nodes)
      .enter()
      .append("g")
        .attr("class", "node");

    var tree = sampleTreeView.createSampleTree();

    visualNodes.selectAll(".yolo")
        .data(function(d) {
          if (d.type == "person") {
            return [d];
          }
          else {
            return [null];
          }
        })
      .enter().each(function(d) {
        if (d) {
          var selection = d3.select(this);
          tree.node(d)(selection);
        }
      });

    var nodeSymbols = visualNodes.append("path")
      .attr("class", "nodeSymbol")
      .attr("d", d3.symbol()
        .type(function(d) {
          if (d.type === "person") {
            if (d.dataNode.sex === "male") {
              return d3.symbolSquare;
            }
            else if (d.dataNode.sex === "female") {
              return d3.symbolCircle;
            }
          }
          else {
            return d3.symbolTriangle;
          }
        })
        .size(500))
      .style("fill", fillColor)
      .attr("visibility", function(d) {
        if (d.type === "marriage") {
          return "hidden";
        }
        else {
          return "visible";
        }
      })
      .on("click", nodeClicked);

    visualNodes.append("text")
      .attr("dx", 15)
      .attr("dy", 15)
      .text(function(d) { 
        if (d.type !== "marriage") {
          return d.dataNode.id;
        }
      });

    visualNodes.attr("transform", function(d) {
      return svgTranslateString(d.x, d.y);
    });
    function zoomed() {
      container.attr("transform", d3.event.transform);
    }
  }

  function nodeClicked(d) {
    if (d.type !== "marriage") {
      var action = {
        "type": "NODE_CLICKED",
        "selection": this,
        "node": d
      };
      store.dispatch(action);
    }
  }

  function stateChanged() {

    var state = store.getState();

    if (state.activeNode) {
      d3.selectAll(".nodeSymbol").style("fill", fillColor);
      d3.select(state.activeNodeSelection).style("fill", "DarkSeaGreen");

      var dngData = null;

      var d = state.activeNode;
      if (d.dataNode.data.dngOutputData !== undefined) {
        dngData = d.dataNode.data.dngOutputData;
      }
      else {
        // TODO: should probably be some sort of search for the correct
        // child, rather than assuming it's the first one.
        //console.log(d.dataNode);
        if (d.dataNode.data.sampleIds.children[0]) {
          dngData = d.dataNode.data.sampleIds.children[0].dngOutputData;
        }
        else {
          dngData = d.dataNode.data.sampleIds.dngOutputData;
        }
      }

      d3.select("#id_display").attr("value", d.dataNode.id);
      d3.select("#gt_display").attr("value", dngData.GT);
      d3.select("#gq_display").attr("value", dngData.GQ);
      d3.select("#gp_display").attr("value", dngData.GP);
      d3.select("#dp_display").attr("value", dngData.DP);
      d3.select("#mup_display").attr("value", format(dngData.MUP));
      d3.select("#mu1p_display").attr("value", format(dngData.MU1P));
    }

    d3.selectAll(".sampleTree").attr("visibility", function(d) {
      if (state.showSampleTrees) {
        return "visible";
      }
      else {
        return "hidden";
      }
    });

    d3.select("#sample_tree_toggle")
      .attr("class", function(d) {
        if (state.showSampleTrees) {
          return "btn btn-danger";
        }
        else {
          return "btn btn-success";
        }
      })
      .text(function(d) {
        if (state.showSampleTrees) {
          return "Hide Trees";
        }
        else {
          return "Show Trees";
        }
      });;
  }

  function svgTranslateString(x, y) {
    return "translate(" + x + "," + y + ")";
  }

  function fillColor(d) {
    if (d.type === "person") {
      if (d.dataNode.sex === "male") {
        return "SteelBlue";
      }
      else if (d.dataNode.sex === "female") {
        return "Tomato";
      }
    }
    else {
      return "black";
    }
  }

  return { render: render };

}($, d3, store));