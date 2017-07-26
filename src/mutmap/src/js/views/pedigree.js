// eslint exceptions
//
/* global d3 */
/* global PubSub */
/* global utils */
/* global sampleTreeView */
/* exported pedigreeView */

(function(Backbone, d3, PubSub) {
  "use strict";

  var format = d3.format(",.6e");

  mutmap.PedigreeView = Backbone.View.extend({
    
    initialize: function() {

      this.activeNodeModel = this.model.get('activeNodeModel');

      this.model.on('change', this.render.bind(this));

      this._create();
      this.render();

      // bounding box of the links in the graph serves as a heuristic for
      // calculating the center of the graph
      var boundingBox = this._links_container.node().getBBox();
      var centerX = boundingBox.width / 2;
      var centerY = boundingBox.height / 2;
      var width = parseInt(this._svg.style("width"));
      var height = parseInt(this._svg.style("height"));
      var xCorrection = (width / 2) - centerX;
      var yCorrection = (height / 2) - centerY;

      var zoom = d3.zoom()
        .on("zoom", zoomed.bind(this));
      this._svg.call(zoom);

      zoom.translateBy(this._svg, xCorrection, yCorrection);
      zoom.scaleBy(this._svg, 0.1, 0.1);

      var transition = this._svg.transition().duration(750);
      zoom.scaleTo(transition, 1.0);

      PubSub.subscribe("ACTIVE_NODE_CHANGED", this._stateUpdate.bind(this));
    },

    _create: function() {

      this._activeNode = null;
      this._showSampleTrees = false;

      this.el.append("svg")
          .attr("class", "pedigree-svg");

      this._svg = this.el.select(".pedigree-svg");

      this._svg.style("height", "100%").style("width", "100%");

      this._container = this._svg.append("g")
          .attr("class", "pedigree-container");

      this._links_container = this._container.append("g")
          .attr("class", "links-container");

      this._nodes_container = this._container.append("g")
          .attr("class", "nodes-container");

    },
   
    render: function() {

      this._updateLinks();
      this._updateNodes();

      var showSampleTrees = this.model.get('showSampleTrees');

      d3.selectAll(".sampleTree")
          .attr("visibility", function() {
            if (showSampleTrees) {
              return "visible";
            }
            else {
              return "hidden";
            }
          });

      d3.select("#sample_tree_toggle")
          .attr("class", function() {
            if (showSampleTrees) {
              return "btn btn-danger";
            }
            else {
              return "btn btn-success";
            }
          })
          .text(function() {
            if (showSampleTrees) {
              return "Hide Trees";
            }
            else {
              return "Show Trees";
            }
          });


      // TODO: I don't really like this. Used trigger instead of .on() because
      // it wasn't working. Maybe something to do with Backbone's diffing
      // algorithm knowing the dataNode reference hasn't changed.
      this.activeNodeModel.trigger('change')
    },

    _updateLinks: function() {

      var links = this.model.get('graphData').links;

      var visualLinksUpdate = this._links_container.selectAll(".link")
          .data(links);

      var visualLinksEnter = visualLinksUpdate.enter()
        .append("g")
          .attr("class", "link");

      var visualLinksEnterUpdate = visualLinksEnter.merge(visualLinksUpdate);

      visualLinksEnter.append("path")
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
          .attr("stroke-dasharray", function(d) {
            if (d.type == "duplicate") {
              return "5, 5";
            }
          })
          .attr("x1", function(d) { return d.source.x; })
          .attr("y1", function(d) { return d.source.y; })
          .attr("x2", function(d) { return d.target.x; })
          .attr("y2", function(d) { return d.target.y; });

      visualLinksEnter.append("text")
        .attr("text-anchor", "middle")
        .attr("dx", function(d) {
          return utils.halfwayBetween(d.source.x, d.target.x);
        })
        .attr("dy", function(d) {
          return utils.halfwayBetween(d.source.y, d.target.y);
        });

      visualLinksEnterUpdate.select("text")
        .text(function(d) {
          if (linkHasMutation(d)) {
            return d.dataLink.data.mutation;
          }
        });

      visualLinksEnterUpdate.select("path")
          .attr("stroke-width", function(d) {
            if (linkHasMutation(d)) {
              return 5;
            }
            return 1;
          })
          .attr("stroke", function(d) {
            if (linkHasMutation(d)) {
              return d3.schemeCategory20[7];
            }

            return "#999";
          });

      function linkHasMutation(d) {
        return d.dataLink !== undefined && d.dataLink.data !== undefined &&
          d.dataLink.data.mutation !== undefined;
      }
    },

    _updateNodes: function() {

      var visualNodesUpdate = this._nodes_container.selectAll(".node")
          .data(this.model.get('graphData').nodes);

      var visualNodesEnter = visualNodesUpdate.enter()
        .append("g")
          .attr("class", "node");

      var visualNodesEnterUpdate = visualNodesEnter.merge(visualNodesUpdate);

      var tree = sampleTreeView.createSampleTree();

      // TODO: this is a hack. I don't even really know why it works...
      visualNodesEnter.selectAll(".yolo")
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

      visualNodesEnterUpdate.call(
        gpNode().activeNodeModel(this.activeNodeModel));
      
      visualNodesEnter.append("text")
        .attr("dx", 15)
        .attr("dy", 15)
        .text(function(d) { 
          if (d.type !== "marriage") {
            return d.dataNode.id;
          }
        })
        .style("pointer-events", "none")
        .style("font", "10px sans-serif");

      visualNodesEnter.attr("transform", function(d) {
        return svgTranslateString(d.x, d.y);
      });
    },

    _stateUpdate: function(topic, data) {

      switch(topic) {

        case "ACTIVE_NODE_CHANGED":
          this._activeNode = data.activeNode;
          d3.selectAll(".node-symbol").classed("node-symbol--selected", false);
          d3.select(data.activeNodeSelection)
              .classed("node-symbol--selected", true);

          this.activeNodeModel.set({
            dataNode: data.activeNode
          });

          break;
        default:
          console.log("unknown event");
          break;
      }
    }
  });

  function zoomed() {
    this._container.attr("transform", d3.event.transform);
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

  function gpNode() {

    var activeNodeModel = null;

    var color = d3.scaleOrdinal(d3.schemeCategory10);
    var pie = d3.pie()
      .sort(null);
    var piePath = d3.arc()
      .outerRadius(15)
      .innerRadius(0);

    function nodeClicked(d) {
      if (d.type !== "marriage") {
        PubSub.publish("ACTIVE_NODE_CHANGED",
          { activeNode: d.dataNode, activeNodeSelection: this });
      }
    }

    function my(selection) {

      selection.each(function(d) {

        if (d.type === "person") {
          if (d.dataNode.sex === "male") {
            if (d.dataNode.data.dngOutputData) {
              var gpSplits =
                calculateGpSplits(d.dataNode.data.dngOutputData.GP);

              var squareWidth = 30;
              var squareHeight = squareWidth;

              var square = d3.select(this).append("g")
                  .attr("class", "node-symbol node-symbol__male")
                  .on("click", nodeClicked);

              // Not using d3 selections because we need to keep track of
              // the relative offsets
              var offset = 0;
              gpSplits.forEach(function(split, index) {

                square.append("g")
                    .attr("class", "partition")
                  .append("rect")
                    .attr("x", -(squareWidth / 2) + offset)
                    .attr("y", -(squareHeight / 2))
                    .attr("width", split*squareWidth)
                    .attr("height", squareHeight)
                    .attr("fill", d3.schemeCategory10[index]);

                offset += split*squareWidth;
              });
            }
          }
          else if (d.dataNode.sex === "female") {
            if (d.dataNode.data.dngOutputData) {
              var gpSplits =
                calculateGpSplits(d.dataNode.data.dngOutputData.GP);

              var pieChart = d3.select(this).append("g")
                  .attr("class", "node-symbol node-symbol__female")
                  .on("click", nodeClicked);

              pieChart.selectAll(".arc")
                  //.data(pie(d.dataNode.data.dngOutputData.GP))
                  .data(pie(gpSplits))
                .enter().append("path")
                  .attr("class", "arc")
                  .attr("d", piePath)
                  .attr("fill", function(d, i) { 
                    return d3.schemeCategory10[i];
                    //return color(d.value);
                  });
            }
          }
          else {
          }
        }
        else {
          return d3.symbolTriangle;
        }

      });
    }

    my.activeNodeModel = function(value) {
      if (!arguments.length) return activeNodeModel;
      activeNodeModel = value;
      return my;
    };

    return my;

    function calculateGpSplits(gp) {

      var gpIndicesTable;

      // TODO: Generate this table algorithmically.
      if (gp.length === 3) {
        // According to VCF spec, ordering is AA, AB, BB
        // see GL section in
        // https://samtools.github.io/hts-specs/VCFv4.2.pdf
        gpIndicesTable = [
          [ 1 ],
          [ 2 ]
        ];
      }
      else if (gp.length === 6) {
        // According to VCF spec, ordering is AA, AB, BB, AC, BC, CC
        // see GL section in
        // https://samtools.github.io/hts-specs/VCFv4.2.pdf
        gpIndicesTable = [
          [ 1, 3 ],
          [ 2, 4, 5 ]
        ];
      }
      else if (gp.length === 10) {
        gpIndicesTable = [
          [ 1, 3, 6 ],
          [ 2, 4, 5, 7, 8, 9 ]
        ];
      }
      else {
        throw "GP indices table not defined for GP length: " + gp.length;
      }

      var refOnly = gp[0];

      var includesRef = 0;
      gpIndicesTable[0].forEach(function(index) {
        includesRef += gp[index];
      });

      var doesNotIncludeRef = 0;
      gpIndicesTable[1].forEach(function(index) {
        doesNotIncludeRef += gp[index];
      });

      return [
        refOnly,
        includesRef,
        doesNotIncludeRef
      ];
    }
  }

  function createPedigreeView(options) {
    return new PedigreeView(options);
  }

  return {
    createPedigreeView: createPedigreeView
  };

}(Backbone, d3, PubSub));